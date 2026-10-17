import { useEffect, useState } from 'react';
import { readCityAccess } from '../admin/repository';
import { supabase } from '../lib/supabase';
import { BrandWordmark } from '../components/BrandWordmark';
import type { Theme } from '../types';
import { Icon } from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { identityProviders } from '../auth/providers';
import { FEDERAL_VK_COMMUNITY } from '../config/vkCommunity';
import { brandAssets } from '../utils/brand';
export function ProfilePage({ theme, setTheme, favoritesCount, openFavorites, city, openLogin, openApplications, openPhotoAdmin, openAdmin, openClassifieds, openCommunity, openFriends, allowThemeSelection }: { allowThemeSelection: boolean; openApplications?: () => void; openPhotoAdmin?: () => void; openAdmin?: () => void; openClassifieds?: () => void; openCommunity?: () => void; openFriends?:()=>void; theme: Theme; setTheme: (theme: Theme) => void; favoritesCount: number; openFavorites: () => void; city: string; openLogin: () => void }) {
 const { state, error, signOut } = useAuth();
 const userId = state.user?.id;
 const hasAdminEntry = Boolean(openAdmin || openPhotoAdmin);
 const [allowedUserId, setAllowedUserId] = useState<string | null>(null);
 useEffect(() => {
  if (!userId || !hasAdminEntry || !supabase) return;
  let active = true;
  readCityAccess(supabase, userId).then(rows => {
   if (active) setAllowedUserId(rows.length > 0 ? userId : null);
  }).catch(() => { if (active) setAllowedUserId(null); });
  return () => { active = false; };
 }, [userId, hasAdminEntry]);
 const canOpenAdmin = state.status === 'authenticated' && allowedUserId === userId;
 const profile = state.profile;
 const avatar = profile?.avatar_url;
 const name = state.status === 'authenticated' ? profile?.display_name || 'Ваш профиль' : 'Вы не вошли в аккаунт';
 return <><div className="page-heading"><span className="eyebrow">ТВОЁ ПРОСТРАНСТВО</span><h1>Профиль</h1></div>
 <section className="profile-card" aria-busy={state.status === 'loading'}><div className="avatar large-avatar"><Icon name="profile" size={32}/>{avatar && <img src={avatar} alt="Аватар профиля" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }}/>}</div><h2>{state.status === 'loading' ? 'Проверяем состояние входа…' : name}</h2><p>{profile?.city ?? city}</p>
 {state.status === 'authenticated' ? <>{!profile && <p>Профиль ещё загружается или готовится. Попробуйте обновить страницу позже.</p>}<span className="profile-badge">Аккаунт Рядом · {favoritesCount} в избранном</span><div className="linked-identities"><h3>Способы входа</h3>{state.identities.length ? <ul>{state.identities.map(identity => <li key={identity.id}>{identityProviders.find(provider => provider.id === identity.provider)?.label ?? 'Ранее привязанный способ входа'}<span>Привязан</span></li>)}</ul> : <p>Нет связанных способов входа</p>}</div><button className="account-signout" onClick={() => { void signOut(); }}>Выйти</button></> : <><p>Ваши находки и настройки на этом устройстве</p><button className="primary-button profile-login" onClick={openLogin}>Войти или зарегистрироваться <Icon name="arrow" size={18}/></button></>}
 {error && <p role="status">{error}</p>}</section>
 {openCommunity&&<button className="profile-row" onClick={openCommunity}><span className="row-icon"><Icon name="places"/></span><span><strong>Городская лента</strong><small>Закрытая тестовая версия новостей и постов жителей</small></span><Icon name="arrow" size={19}/></button>}
 {openClassifieds&&<button className="profile-row" onClick={openClassifieds}><span className="row-icon"><Icon name="places"/></span><span><strong>Объявления и сообщения</strong><small>Тестовая версия, доступна только с тестовой базой</small></span><Icon name="arrow" size={19}/></button>}
 <button className="profile-row" onClick={openFavorites}><span className="row-icon"><Icon name="heart"/></span><span><strong>Избранное</strong><small>Все твои находки в одном месте</small></span><span className="row-count">{favoritesCount}</span><Icon name="arrow" size={19}/></button>
 {openAdmin && canOpenAdmin && <button className="profile-row" onClick={openAdmin}><span className="row-icon"><Icon name="places"/></span><span><strong>Управление городом</strong><small>Организации, фотографии, контакты и публикации</small></span><Icon name="arrow" size={19}/></button>}
 {openPhotoAdmin && !openAdmin && canOpenAdmin && <button className="profile-row" onClick={openPhotoAdmin}><span className="row-icon"><Icon name="places"/></span><span><strong>Фотографии организаций</strong><small>Загрузить настоящие снимки в каталог</small></span><Icon name="arrow" size={19}/></button>}
 {openApplications && <button className="profile-row" onClick={openApplications}><span className="row-icon"><Icon name="pin"/></span><span><strong>Мои заявки</strong><small>Сведения организаций на рассмотрении</small></span><Icon name="arrow" size={19}/></button>}
 {openFriends && <button className="profile-row" onClick={openFriends}><span className="row-icon"><Icon name="pin"/></span><span><strong>Друзья рядом</strong><small>Приглашения и добровольная геолокация на один час</small></span><Icon name="arrow" size={19}/></button>}
 <a className="profile-row profile-social-link" href={FEDERAL_VK_COMMUNITY.url} target="_blank" rel="noopener noreferrer" aria-label="Федеральная группа РЯДОМ во ВКонтакте — открыть в новой вкладке"><span className="row-icon"><img src={brandAssets.vk} width="24" height="24" alt="" loading="lazy"/></span><span><strong>Мы во ВКонтакте</strong><small>Федеральное сообщество «РЯДОМ» — новости и сотрудничество</small></span><Icon name="arrow" size={19}/></a>
 <div className="profile-future">{['Мои отзывы', 'Мои события'].map(title => <button className="profile-row" key={title} disabled><span><strong>{title}</strong></span><span className="row-count">Скоро</span></button>)}</div>
 {allowThemeSelection && <section className="settings-card"><h2>Как тебе удобнее</h2><p>Тема приложения</p><div className="theme-options" role="group" aria-label="Тема приложения">{([{ value: 'system', label: 'Авто', icon: 'profile' }, { value: 'light', label: 'Светлая', icon: 'sun' }, { value: 'dark', label: 'Тёмная', icon: 'moon' }] as const).map(option => <button key={option.value} className={theme === option.value ? 'selected' : ''} aria-pressed={theme === option.value} onClick={() => setTheme(option.value)}><Icon name={option.icon} size={20}/>{option.label}</button>)}</div><small>Авто — тема вашего устройства.</small></section>}
 <section className="about-card"><span className="brand brand-logo-pin about-brand"><BrandWordmark/></span><h2>Город ближе, чем кажется.</h2><p>Открывай места, строй планы и находи своих людей. Всё хорошее может быть совсем рядом.</p><small>Версия 0.1.0 · Сделано для небольших городов</small></section><p className="privacy-note">{state.status === 'authenticated' ? 'Избранное синхронизируется с аккаунтом. Локальный кеш хранится отдельно для каждого аккаунта; тема сохраняется на устройстве.' : 'Избранное и тема хранятся только в этом браузере и не синхронизируются между устройствами.'}</p></>;
}
