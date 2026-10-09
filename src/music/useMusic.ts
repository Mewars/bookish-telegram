import { useContext } from 'react';
import { MusicContext } from './context';
export function useMusic() {
  const music = useContext(MusicContext);
  if (!music) throw new Error('MusicProvider is required');
  return music;
}
