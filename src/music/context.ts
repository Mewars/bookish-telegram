import { createContext } from 'react';
import { musicPlayer } from './audioPlayer';
export const MusicContext = createContext<ReturnType<typeof musicPlayer.getSnapshot> & typeof musicPlayer | null>(null);
