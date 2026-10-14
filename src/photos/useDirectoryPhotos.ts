import { useEffect, useState } from 'react';
import type { Item } from '../types';
import { supabase } from '../lib/supabase';
import { applyDirectoryPhotos, readDirectoryPhotos, type DirectoryPhotoRow } from './directoryPhotos';

export function useDirectoryPhotos(items: Item[], enabled: boolean) {
  const [photos, setPhotos] = useState<DirectoryPhotoRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !supabase) return;
    let active = true;
    Promise.resolve().then(() => readDirectoryPhotos(supabase)).then(rows => {
      if (active) { setPhotos(rows); setStatus('ready'); }
    }).catch(() => {
      if (active) { setStatus('unavailable'); setPhotos([]); }
    });
    return () => { active = false; };
  }, [enabled, attempt]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { setStatus('loading'); setAttempt(n => n + 1); };
    window.addEventListener('ryadom:card-photos-changed', refresh);
    return () => window.removeEventListener('ryadom:card-photos-changed', refresh);
  }, [enabled]);

  const decorated = enabled && status === 'ready' ? applyDirectoryPhotos(items, photos, supabase) : items;
  return { items: decorated, photos, status,
    refresh: () => { setStatus('loading'); setAttempt(n => n + 1); } };
}
