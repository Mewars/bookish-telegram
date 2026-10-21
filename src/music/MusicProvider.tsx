import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { musicPlayer } from './audioPlayer';
import { MusicContext } from './context';
import { attachMusicHostBridge } from './hostBridge';
export function MusicProvider({ children }: { children: ReactNode }) {
  useEffect(() => attachMusicHostBridge(), []);
  const state = useSyncExternalStore(musicPlayer.subscribe, musicPlayer.getSnapshot);
  return <MusicContext.Provider value={{ ...musicPlayer, ...state }}>{children}</MusicContext.Provider>;
}
