import { useEffect, useState } from 'react';
import { defaultCity, isAvailableCity, type DirectoryCity } from '../data/cities';
import { readStorage, saveStorage } from '../utils/storage';

export function useCity(cities: readonly DirectoryCity[], ready = true) {
  // A city fetched from Supabase may not yet be in the fallback list at startup.
  const [storedCity, setCity] = useState<string>(() => readStorage('ryadom.city', defaultCity,
    (value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100));
  const [storageError, setStorageError] = useState(false);
  const city = ready && !isAvailableCity(storedCity, cities) ? defaultCity : storedCity;
  useEffect(() => { saveStorage('ryadom.city', city); }, [city]);

  const selectCity = (value: string) => {
    if (!isAvailableCity(value, cities)) return;
    setCity(value);
    setStorageError(!saveStorage('ryadom.city', value));
  };

  return { city, selectCity, storageError };
}
