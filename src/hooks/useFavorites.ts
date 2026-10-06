import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { guestFavoritesRepository } from '../services/guestFavorites';
import { favoritesCache } from '../services/favoritesCache';
import { createAccountFavoritesRepository, mergeGuestFavorites } from '../services/accountFavorites';
const repository = supabase ? createAccountFavoritesRepository(supabase) : null;
interface Mutation { id: string; saved: boolean }
interface Scope {
  owner: string;
  active: boolean;
  ready: boolean;
  confirmed: string[];
  pending: Mutation[];
  queue: Promise<void>;
}
interface View { owner: string | null; ids: string[]; ready: boolean; pending: number; error: string | null; storageError: boolean }
function applyMutation(ids: string[], action: Mutation) {
  return action.saved ? [...new Set([...ids, action.id])] : ids.filter(id => id !== action.id);
}
export function useFavorites() {
  const { state } = useAuth();
  const owner = state.status === 'authenticated' ? state.user.id : null;
  const [view, setView] = useState<View>(() => ({ owner: null, ids: guestFavoritesRepository.read(), ready: true, pending: 0, error: null, storageError: false }));
  const [retryCount, setRetryCount] = useState(0);
  const scopeRef = useRef<Scope | null>(null);
  useEffect(() => {
    if (!owner || !repository) {
      scopeRef.current = null;
      let active = true;
      Promise.resolve().then(() => { if (active) setView({ owner: null, ids: guestFavoritesRepository.read(), ready: true, pending: 0, error: null, storageError: false }); });
      return () => { active = false; };
    }
    const scope: Scope = { owner, active: true, ready: false, confirmed: [], pending: [], queue: Promise.resolve() };
    scopeRef.current = scope;
    const load = async () => {
      if (!scope.active) return;
      setView({ owner, ids: favoritesCache.read(owner), ready: false, pending: 0, error: null, storageError: false });
      try {
        const imported = favoritesCache.wasImported(owner);
        const ids = imported ? await repository.list(owner) : await mergeGuestFavorites(owner, guestFavoritesRepository.read(), repository);
        if (!scope.active) return;
        scope.confirmed = ids; scope.ready = true;
        const cached = favoritesCache.write(owner, ids);
        const marked = imported || favoritesCache.markImported(owner);
        setView({ owner, ids, ready: true, pending: 0, error: null, storageError: !cached || !marked });
      } catch {
        if (scope.active) setView({ owner, ids: favoritesCache.read(owner), ready: false, pending: 0, error: 'Не удалось синхронизировать избранное. Проверьте соединение и повторите.', storageError: false });
      }
    };
    void Promise.resolve().then(load);
    return () => { scope.active = false; };
  }, [owner, retryCount]);
  const favorites = view.owner === owner ? view.ids : owner ? favoritesCache.read(owner) : guestFavoritesRepository.read();
  const syncing = state.status === 'loading' || !!owner && (view.owner !== owner || !view.ready);
  const toggle = (id: string) => {
    if (syncing) return;
    if (!owner) {
      const next = applyMutation(favorites, { id, saved: !favorites.includes(id) });
      setView({ owner: null, ids: next, ready: true, pending: 0, error: null, storageError: !guestFavoritesRepository.write(next) });
      return;
    }
    const scope = scopeRef.current;
    if (!scope?.active || !scope.ready || scope.owner !== owner || !repository) return;
    const action: Mutation = { id, saved: !favorites.includes(id) };
    scope.pending.push(action);
    const publish = (error: string | null, clearError = false) => {
      if (!scope.active) return;
      const ids = scope.pending.reduce(applyMutation, scope.confirmed);
      const cached = favoritesCache.write(owner, scope.confirmed);
      setView(previous => ({ owner, ids, ready: true, pending: scope.pending.length, error: error ?? (clearError ? null : previous.error), storageError: previous.storageError || !cached }));
    };
    publish(null, true);
    // Serialize mutations; rendering immediately applies all pending intents over confirmed data.
    scope.queue = scope.queue.then(async () => {
      if (!scope.active) return;
      let error: string | null = null;
      try {
        if (action.saved) await repository.add(owner, [id]);
        else await repository.remove(owner, id);
        if (!scope.active) return;
        scope.confirmed = applyMutation(scope.confirmed, action);
      } catch { error = 'Изменение избранного не сохранено. Проверьте соединение и повторите действие.'; }
      if (!scope.active) return;
      scope.pending = scope.pending.filter(item => item !== action);
      publish(error);
    });
  };
  const retry = () => { if (!view.pending) setRetryCount(count => count + 1); };
  return { favorites, toggle, syncing, retry, syncError: view.owner === owner ? view.error : null, storageError: view.owner === owner && view.storageError };
}
