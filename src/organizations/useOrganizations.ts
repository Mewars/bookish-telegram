import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { catalog } from '../data/catalog';
import cityImage from '../assets/city.svg';
import { mergePublished } from './model';
import type { OrganizationRow } from './model';
import { readPublished } from './repository';
export function useOrganizations(enabled: boolean) {
  const [remote, setRemote] = useState<OrganizationRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>(enabled ? 'loading' : 'ready');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    readPublished(supabase).then(rows => { if (active) { setRemote(rows); setStatus('ready'); } }).catch(() => { if (active) { setRemote([]); setStatus('fallback'); } });
    return () => { active = false; };
  }, [enabled, attempt]);
  return { items: enabled ? mergePublished(catalog, remote, cityImage) : catalog, status, retry: () => { setStatus('loading'); setAttempt(value => value + 1); } };
}
