import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from './Icon';

/** Same authenticated avatar as on ProfilePage, never a public image lookup. */
export function HeaderUserAvatar() {
  const { state } = useAuth();
  const raw = state.status === 'authenticated' ? state.profile?.avatar_url : null;
  const [failed, setFailed] = useState<string | null>(null);
  let avatar: string | null = null;
  if (raw) {
    try {
      const uri = new URL(raw);
      if (uri.protocol === 'https:' && !uri.username && !uri.password) avatar = uri.href;
    } catch { /* Invalid or missing avatar: keep generic icon. */ }
  }

  return <>
    <Icon name="profile" size={20}/>
    {avatar && avatar !== failed && <img className="header-user-avatar" src={avatar} alt=""
      loading="lazy" referrerPolicy="no-referrer"
      onError={() => setFailed(avatar)}/>}
  </>;
}
