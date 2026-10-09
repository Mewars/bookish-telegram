import { trackMusicEvent } from '../analytics/yandexMetrika';

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
const streamUrl = 'https://radiorecord.hostingradio.ru/rr_main96.aacp';
const volumeKey = 'ryadom_music_volume';
function restoredVolume() {
  try {
    const raw = localStorage.getItem(volumeKey);
    const value = raw === null ? 0.6 : Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.6;
  } catch { return 0.6; }
}
let snapshot = {
  status: 'idle' as MusicStatus, isPlaying: false, volume: restoredVolume(),
  isMuted: false, isExpanded: false, isOpen: false,
  error: null as string | null, stationName: 'Radio Record',
};
const listeners = new Set<() => void>();
// One lazily created element for the whole SPA, independent of React mounts.
let audio: HTMLAudioElement | undefined;
let requested = false;
let attempt = 0;
let timeout: ReturnType<typeof setTimeout> | undefined;
function update(values: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...values };
  listeners.forEach(listener => listener());
}
function clearTimeoutGuard() { clearTimeout(timeout); timeout = undefined; }
function fail(blocked = false) {
  if (!requested) return;
  requested = false;
  attempt++;
  clearTimeoutGuard();
  update({ status: 'error', isPlaying: false, error: blocked
    ? 'Не удалось запустить радио в этом браузере.'
    : 'Радио временно недоступно. Попробуйте ещё раз.' });
  audio?.pause();
  trackMusicEvent('music_error');
}
function waitForStream() {
  if (!requested) return;
  update({ status: 'loading', isPlaying: false });
  if (!timeout) timeout = setTimeout(() => fail(), 15000);
}
function getAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.volume = snapshot.volume;
  audio.muted = snapshot.isMuted;
  audio.addEventListener('playing', () => {
    if (!requested) { audio?.pause(); return; }
    clearTimeoutGuard();
    const firstPlaying = snapshot.status !== 'playing';
    update({ status: 'playing', isPlaying: true, error: null });
    if (firstPlaying) trackMusicEvent('music_play');
  });
  audio.addEventListener('pause', () => {
    if (requested) { requested = false; attempt++; clearTimeoutGuard(); }
    if (snapshot.status !== 'error' && snapshot.status !== 'paused') {
      update({ status: 'paused', isPlaying: false });
      trackMusicEvent('music_pause');
    }
  });
  audio.addEventListener('waiting', waitForStream);
  audio.addEventListener('stalled', waitForStream);
  audio.addEventListener('error', () => fail());
  audio.addEventListener('ended', () => fail());
  return audio;
}
export const musicPlayer = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  async play() {
    if (requested) return;
    const token = ++attempt;
    requested = true;
    const retrying = snapshot.status === 'error';
    update({ status: 'loading', isPlaying: false, error: null, isOpen: true });
    waitForStream();
    try {
      const element = getAudio();
      if (!element.src) element.src = streamUrl;
      else if (retrying) element.load();
      await element.play();
      // 'playing' is authoritative; stale promise results cannot undo pause/retry.
    } catch (error) {
      if (token === attempt) fail(error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'NotSupportedError'));
    }
  },
  pause() {
    requested = false;
    attempt++;
    clearTimeoutGuard();
    const active = snapshot.status === 'playing' || snapshot.status === 'loading';
    update({ status: 'paused', isPlaying: false, error: null });
    audio?.pause();
    if (active) trackMusicEvent('music_pause');
  },
  toggle() { if (requested) musicPlayer.pause(); else void musicPlayer.play(); },
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    const volume = Math.min(1, Math.max(0, value));
    if (audio) audio.volume = volume;
    update({ volume });
    try { localStorage.setItem(volumeKey, String(volume)); } catch { /* Playback remains available. */ }
  },
  toggleMute() { const isMuted = !snapshot.isMuted; if (audio) audio.muted = isMuted; update({ isMuted }); },
  openPlayer() { update({ isOpen: true }); },
  closePlayer() { update({ isOpen: false, isExpanded: false }); },
  toggleExpanded() { update({ isExpanded: !snapshot.isExpanded }); },
};
