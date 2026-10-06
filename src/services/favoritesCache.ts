import { readStorage, saveStorage } from '../utils/storage';
const cacheKey = (userId: string) => `ryadom.favorites.account.${userId}`;
const migrationKey = (userId: string) => `ryadom.favorites.imported.${userId}`;
export const favoritesCache = {
  read(userId: string): string[] { return readStorage(cacheKey(userId), [], (v): v is string[] => Array.isArray(v) && v.every(id => typeof id === 'string')); },
  write(userId: string, ids: string[]) { return saveStorage(cacheKey(userId), ids); },
  wasImported(userId: string) { return readStorage(migrationKey(userId), false, (v): v is boolean => typeof v === 'boolean'); },
  markImported(userId: string) { return saveStorage(migrationKey(userId), true); },
};
