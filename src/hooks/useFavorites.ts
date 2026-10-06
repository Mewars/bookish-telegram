import { useState } from 'react';
import { readStorage, saveStorage } from '../utils/storage';
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => readStorage('ryadom.favorites', [], (v): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')));
  const [storageError, setStorageError] = useState(false);
  const toggle = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavorites(next); setStorageError(!saveStorage('ryadom.favorites', next));
  };
  return { favorites, toggle, storageError };
}
