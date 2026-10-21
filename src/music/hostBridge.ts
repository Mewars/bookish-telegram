import { musicPlayer } from './audioPlayer';

// Same-document controls for the standalone section shell. No audio element is
// created here: the existing player remains the single source of truth.
export function attachMusicHostBridge(target: Window = window) {
  const publish = () => {
    const { status, isPlaying, volume, isMuted, isOpen } = musicPlayer.getSnapshot();
    target.dispatchEvent(new CustomEvent('ryadom:music-state', {
      detail: { status, isPlaying, volume, isMuted, isOpen },
    }));
  };
  const command = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object' || !('action' in detail)) return;
    switch (detail.action) {
      case 'request-state': publish(); break;
      case 'toggle': musicPlayer.toggle(); break;
      case 'toggle-mute': musicPlayer.toggleMute(); break;
      case 'open-player': musicPlayer.openPlayer(); break;
      case 'set-volume':
        if ('value' in detail && typeof detail.value === 'number') musicPlayer.setVolume(detail.value);
        break;
    }
  };
  target.addEventListener('ryadom:music-command', command);
  const unsubscribe = musicPlayer.subscribe(publish);
  publish();
  return () => {
    unsubscribe();
    target.removeEventListener('ryadom:music-command', command);
  };
}
