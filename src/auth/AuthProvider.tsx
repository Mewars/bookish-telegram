import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './context';
import { supabase } from '../lib/supabase';
import { readAccountData, updateCurrentProfile } from './adapter';
import type { AuthState, ProfileUpdate } from '../types/auth';
const guest: AuthState = { status: 'guest', user: null, profile: null, identities: [] };
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, profile: null, identities: [] });
  const [error, setError] = useState<string | null>(null);
  const sessionRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const invalidateSession = () => { sessionRevision.current++; };
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applySession = async (session: Session | null, revision: number) => {
      if (!active || revision !== sessionRevision.current) return;
      setError(null);
      if (!session) { setState(guest); return; }
      const user = { id: session.user.id };
      setState(previous => previous.status === 'authenticated' && previous.user.id === user.id
        ? previous : { status: 'authenticated', user, profile: null, identities: [] });
      try {
        const account = await readAccountData(supabase!, user.id);
        if (!active || revision !== sessionRevision.current) return;
        setState({ status: 'authenticated', user, profile: account.profile, identities: account.identities });
        setError(account.error);
      } catch {
        if (active && revision === sessionRevision.current) setError('Не удалось загрузить профиль. Приложение остаётся доступным.');
      }
    };
    if (!supabase) {
      const timer = setTimeout(() => { if (active) setState(guest); }, 0);
      return () => { active = false; clearTimeout(timer); invalidateSession(); };
    }
    // Callback stays synchronous: Supabase calls inside it can deadlock the auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const revision = ++sessionRevision.current;
      const timer = setTimeout(() => { timers.delete(timer); void applySession(session, revision); }, 0);
      timers.add(timer);
    });
    const restoreRevision = sessionRevision.current;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || restoreRevision !== sessionRevision.current) return;
      if (sessionError) { setState(guest); setError('Не удалось проверить вход. Доступен гостевой режим.'); return; }
      void applySession(data.session, ++sessionRevision.current);
    }).catch(() => {
      if (active && restoreRevision === sessionRevision.current) { setState(guest); setError('Не удалось проверить вход. Доступен гостевой режим.'); }
    });
    return () => { active = false; invalidateSession(); subscription.unsubscribe(); timers.forEach(clearTimeout); };
  }, []);
  const signOut = async () => {
    if (!supabase || state.status !== 'authenticated') return;
    const revision = sessionRevision.current;
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      // SIGNED_OUT subscription normally clears state; fallback also handles no event.
      if (sessionRevision.current === revision) { sessionRevision.current++; setState(guest); setError(null); }
    } catch { if (sessionRevision.current === revision) setError('Не удалось выйти. Попробуйте ещё раз.'); }
  };
  const updateProfile = async (patch: ProfileUpdate) => {
    if (!supabase || state.status !== 'authenticated') return false;
    const userId = state.user.id;
    const revision = sessionRevision.current;
    try {
      const profile = await updateCurrentProfile(supabase, userId, patch);
      if (revision !== sessionRevision.current) return false;
      if (!profile) { setError('Профиль ещё не создан. Попробуйте позже.'); return false; }
      setState(previous => previous.status === 'authenticated' && previous.user.id === userId ? { ...previous, profile } : previous);
      setError(null); return true;
    } catch {
      if (revision === sessionRevision.current) setError('Не удалось сохранить профиль. Попробуйте ещё раз.');
      return false;
    }
  };
  return <AuthContext.Provider value={{ state, error, signOut, updateProfile }}>{children}</AuthContext.Provider>;
}
