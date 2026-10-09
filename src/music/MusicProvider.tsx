import { useSyncExternalStore, type ReactNode } from 'react';
import { musicPlayer } from './audioPlayer';
import { MusicContext } from './context';
export function MusicProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(musicPlayer.subscribe, musicPlayer.getSnapshot);
  return <MusicContext.Provider value={{ ...musicPlayer, ...state }}>{children}</MusicContext.Provider>;
}
