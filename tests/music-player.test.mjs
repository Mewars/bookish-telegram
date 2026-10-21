import assert from 'node:assert/strict';
import { test } from 'node:test';

const { EventTarget, Event, CustomEvent, DOMException } = globalThis;
const stored = new Map([['ryadom_music_volume', '0.35']]);
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key,value) => stored.set(key,value) };
const instances = [];
class FakeAudio extends EventTarget {
  src = ''; paused = true; volume = 1; muted = false; plays = 0;
  playResult = () => Promise.resolve();
  constructor() { super(); instances.push(this); }
  play() { this.plays++; this.paused = false; return this.playResult(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } }
  load() {}
}
globalThis.Audio = FakeAudio;
// Consent registers a storage listener during import; analytics stays disabled
// in this non-browser test once that listener has been installed.
globalThis.window = new EventTarget();
const { musicPlayer } = await import('../src/music/audioPlayer.ts');
const { attachMusicHostBridge } = await import('../src/music/hostBridge.ts');
delete globalThis.window;

test('music state and shell controls share one player and never invent playback', async t => {
  const target = new EventTarget();
  const states = [];
  target.addEventListener('ryadom:music-state', event => states.push(event.detail));
  const command = detail => target.dispatchEvent(new CustomEvent('ryadom:music-command', { detail }));
  let detach = attachMusicHostBridge(target);
  try {
    await t.test('idle does not autoplay; loading waits for the actual playing event', async () => {
      assert.equal(instances.length, 0);
      assert.equal(states.at(-1).status, 'idle');
      assert.equal(states.at(-1).volume, 0.35);
      await musicPlayer.play();
      assert.equal(instances.length, 1);
      assert.equal(states.at(-1).status, 'loading');
      assert.equal(states.at(-1).isPlaying, false);
      instances[0].dispatchEvent(new Event('playing'));
      assert.equal(states.at(-1).isPlaying, true);
    });
    await t.test('shell volume, mute and pause affect the same audio object', () => {
      command({ action: 'set-volume', value: 0.23 });
      assert.equal(instances[0].volume, 0.23);
      assert.equal(stored.get('ryadom_music_volume'), '0.23');
      command({ action: 'toggle-mute' });
      assert.equal(instances[0].muted, true);
      command({ action: 'toggle' });
      assert.equal(states.at(-1).status, 'paused');
      assert.equal(states.at(-1).isPlaying, false);
      assert.equal(instances[0].paused, true);
    });
    await t.test('reconnecting the shell preserves pause and volume without duplicate listeners or audio', async () => {
      detach();
      const before = states.length;
      musicPlayer.setVolume(0.42);
      assert.equal(states.length, before);
      detach = attachMusicHostBridge(target);
      assert.equal(states.at(-1).status, 'paused');
      assert.equal(states.at(-1).volume, 0.42);
      command({ action: 'open-player' });
      assert.equal(musicPlayer.getSnapshot().isOpen, true);
      command({ action: 'toggle' });
      await Promise.resolve();
      instances[0].dispatchEvent(new Event('playing'));
      assert.equal(states.at(-1).isPlaying, true);
      assert.equal(instances.length, 1);
      command({ action: 'set-volume', value: '0.9' });
      command({ action: 'set-volume', value: Number.NaN });
      assert.equal(instances[0].volume, 0.42);
    });
    await t.test('stream failure and stale play rejection cannot claim that audio is playing', async () => {
      instances[0].dispatchEvent(new Event('error'));
      assert.equal(states.at(-1).status, 'error');
      assert.equal(states.at(-1).isPlaying, false);
      let rejectPlay;
      instances[0].playResult = () => new Promise((resolve,reject) => { rejectPlay = reject; });
      const pending = musicPlayer.play();
      musicPlayer.pause();
      rejectPlay(new DOMException('blocked', 'NotAllowedError'));
      await pending;
      assert.equal(states.at(-1).status, 'paused');
      assert.equal(states.at(-1).isPlaying, false);
    });
  } finally { musicPlayer.pause(); detach(); }
});
