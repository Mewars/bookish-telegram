import { readStorage, saveStorage } from '../utils/storage';
const storageKey = 'ryadom.favorites';
export const guestFavoritesRepository = {
  read(): string[] {
    return readStorage(storageKey, [], (value): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string'));
  },
  write(ids: string[]): boolean { return saveStorage(storageKey, ids); },
};
