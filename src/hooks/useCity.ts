import { useEffect, useState } from 'react';
import { defaultCity, isAvailableCity, type DirectoryCity } from '../data/cities';
import { readStorage, saveStorage } from '../utils/storage';

export function useCity(cities: readonly DirectoryCity[], ready = true) {
  // A city fetched from Supabase may not yet be in the fallback list at startup.
  const [city, setCity] = useState<string>(() => readStorage('ryadom.city', defaultCity,
    value => typeof value === 'string' && value.length > 0 && value.length <= 100));
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (ready && !isAvailableCity(city, cities)) setCity(defaultCity);
  }, [ready, city, cities]);
  useEffect(() => { saveStorage('ryadom.city', city); }, [city]);

  const selectCity = (value: string) => {
    if (!isAvailableCity(value, cities)) return;
    setCity(value);
    setStorageError(!saveStorage('ryadom.city', value));
  };

  return { city, selectCity, storageError };
}
