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
    readPublished(supabase).then(rows => {
      if (active) { setRemote(rows); setStatus('ready'); }
    }).catch(() => {
      if (active) { setRemote([]); setStatus('fallback'); }
    });
    return () => { active = false; };
  }, [enabled, attempt]);
  useEffect(() => {
    if (!enabled) return;
    const onChange = () => { setStatus('loading'); setAttempt(value => value + 1); };
    window.addEventListener('ryadom:organizations-changed', onChange);
    return () => window.removeEventListener('ryadom:organizations-changed', onChange);
  }, [enabled]);
  // Once the seeded database is available it becomes authoritative:
  // archived local seed cards must not reappear in the browser.
  const items = enabled && status === 'ready'
    ? mergePublished(catalog, remote, cityImage, true)
    : catalog;
  return { items, status, retry: () => { setStatus('loading'); setAttempt(value => value + 1); } };
}
