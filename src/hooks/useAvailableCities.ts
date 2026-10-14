import { useEffect, useState } from 'react';
import { availableCities, type DirectoryCity } from '../data/cities';
import { supabase } from '../lib/supabase';
import { withDeadline } from '../organizations/repository';

const normalize = (rows: DirectoryCity[]): DirectoryCity[] => {
  const registry = new Map<string, DirectoryCity>(availableCities.map(city => [city.name, city]));
  for (const city of rows) {
    if (typeof city.name !== 'string' || !city.name.trim() ||
      typeof city.region !== 'string' || !city.region.trim()) continue;
    // The public register is authoritative for updated city covers and regions.
    registry.set(city.name, city);
  }
  return [...registry.values()].sort((a,b) => a.name.localeCompare(b.name, 'ru'));
};

// Disabled until the city_directory SQL is verified on an isolated database.
export function useAvailableCities(enabled: boolean) {
  const [cities, setCities] = useState<DirectoryCity[]>(availableCities);
  const [ready, setReady] = useState(!enabled || !supabase);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled || !supabase) return;
    let active = true;
    Promise.resolve().then(() => withDeadline(signal => supabase.from('city_directory')
      .select('name,region,cover_url,tagline,summary').eq('active', true).order('name').abortSignal(signal)))
      .then(({ data, error }) => {
        if (error || !Array.isArray(data)) throw new Error('City registry unavailable');
        if (active) { setCities(normalize(data as DirectoryCity[])); setReady(true); }
      })
      .catch(() => { if (active) { setCities(availableCities); setReady(true); } });
    return () => { active = false; };
  }, [enabled, version]);
  return { cities, ready, refreshCities: () => setVersion(value => value + 1) };
}
