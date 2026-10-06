import { useEffect, useState } from 'react';
import { defaultCity, isAvailableCity } from '../data/cities';
import { readStorage, saveStorage } from '../utils/storage';

export function useCity() {
  const [city, setCity] = useState<string>(() => readStorage('ryadom.city', defaultCity, isAvailableCity));
  const [storageError, setStorageError] = useState(false);

  useEffect(() => { saveStorage('ryadom.city', city); }, [city]);

  const selectCity = (value: string) => {
    if (!isAvailableCity(value)) return;
    setCity(value);
    setStorageError(!saveStorage('ryadom.city', value));
  };

  return { city, selectCity, storageError };
}
