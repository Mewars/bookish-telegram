import { useEffect, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useFavorites } from './hooks/useFavorites';
import { useRoute } from './hooks/useRoute';
import { catalog } from './data/catalog';
import { Navigation } from './components/Navigation';
import { Icon } from './components/Icon';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProfilePage } from './pages/ProfilePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { DetailPage } from './pages/DetailPage';
import { EmptyState } from './components/EmptyState';
import type { Item } from './types';
export default function App() {
 const { user, theme, setTheme, webApp } = useTelegram();
 const { favorites, toggle, storageError } = useFavorites();
 const { section, id, navigate } = useRoute();
 const mainRef = useRef<HTMLElement>(null);
 const item = id ? catalog.find(x => x.id === id) : undefined;
 const goBack = () => navigate(section === 'favorites' ? 'profile' : section);
 const open = (entry: Item) => navigate(section, entry.id);
 const actions = { favorites, toggle, open };
 useEffect(() => { window.scrollTo({ top: 0 }); mainRef.current?.focus({ preventScroll: true }); }, [section, id]);
 useEffect(() => {
  const back = webApp?.BackButton;
  const callback = () => { window.location.hash = `/${id ? section : 'profile'}`; };
  if (id || section === 'favorites') { back?.show(); back?.onClick(callback); }
  else back?.hide();
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && id) callback(); };
  window.addEventListener('keydown', escape);
  return () => { back?.offClick(callback); back?.hide(); window.removeEventListener('keydown', escape); };
 }, [id, section, webApp]);
 return <div className="app-shell"><header className="app-header"><button className="brand" onClick={() => navigate('home')} aria-label="Рядом — на главную">рядом<span>✳</span></button><div className="city-pill"><Icon name="pin" size={14}/><span>Наш город</span><span className="demo-pill">демо</span></div><button className="header-heart" onClick={() => navigate('favorites')} aria-label={`Избранное: ${favorites.length}`}><Icon name="heart" size={21}/>{favorites.length > 0 && <span>{favorites.length}</span>}</button></header>
 <main ref={mainRef} tabIndex={-1} key={`${section}/${id ?? ''}`}>
 {id ? item ? <DetailPage item={item} saved={favorites.includes(item.id)} toggle={toggle} goBack={() => navigate(section)}/> : <EmptyState title="Карточка не найдена" text="Возможно, ссылка устарела. Посмотрите свежую подборку." action="На главную" onAction={() => navigate('home')}/> : section === 'home' ? <HomePage {...actions} user={user} navigate={navigate}/> : section === 'profile' ? <ProfilePage user={user} theme={theme} setTheme={setTheme} favoritesCount={catalog.filter(x => favorites.includes(x.id)).length} openFavorites={() => navigate('favorites')}/> : section === 'favorites' ? <FavoritesPage {...actions} goBack={goBack} explore={() => navigate('events')}/> : <CatalogPage key={section} kind={section} {...actions}/>}
 <footer className="content-footer"><span className="footer-flower">✳</span> Для тех, кто любит свой город.<small>Демо: все места, события и услуги вымышлены.</small></footer>
 </main>{storageError && <div role="status" className="storage-warning">Браузер запретил сохранение. Избранное доступно до закрытия приложения.</div>}<Navigation section={section} navigate={navigate}/></div>;
}
