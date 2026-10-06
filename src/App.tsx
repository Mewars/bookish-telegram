import { useEffect, useRef, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useFavorites } from './hooks/useFavorites';
import { useRoute } from './hooks/useRoute';
import { useCity } from './hooks/useCity';
import { CityPicker } from './components/CityPicker';
import { filterByCity } from './utils/city';
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
 const { city, selectCity, storageError: cityStorageError } = useCity();
 const [cityPickerOpen, setCityPickerOpen] = useState(false);
 const cityItems = filterByCity(catalog, city);
 const favoritesCount = cityItems.filter(entry => favorites.includes(entry.id)).length;
 const mainRef = useRef<HTMLElement>(null);
 const item = id ? cityItems.find(x => x.id === id) : undefined;
 const goBack = () => navigate(section === 'favorites' ? 'profile' : section);
 const open = (entry: Item) => navigate(section, entry.id);
 const actions = { favorites, toggle, open };
 useEffect(() => { window.scrollTo({ top: 0 }); mainRef.current?.focus({ preventScroll: true }); }, [section, id]);
 useEffect(() => {
  const back = webApp?.BackButton;
  const callback = () => { if (cityPickerOpen) { setCityPickerOpen(false); return; } window.location.hash = `/${id ? section : 'profile'}`; };
  if (cityPickerOpen || id || section === 'favorites') { back?.show(); back?.onClick(callback); }
  else back?.hide();
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && id && !cityPickerOpen) callback(); };
  window.addEventListener('keydown', escape);
  return () => { back?.offClick(callback); back?.hide(); window.removeEventListener('keydown', escape); };
 }, [id, section, webApp, cityPickerOpen]);
 return <div className="app-shell"><header className="app-header"><button className="brand" onClick={() => navigate('home')} aria-label="Рядом — на главную">рядом<span>✳</span></button><button className="city-pill" onClick={() => setCityPickerOpen(true)} aria-label={`Выбрать город: ${city}`} aria-haspopup="dialog" aria-expanded={cityPickerOpen}><Icon name="pin" size={14}/><span>{city}</span><span className="city-chevron" aria-hidden="true"><Icon name="back" size={12}/></span></button><button className="header-heart" onClick={() => navigate('favorites')} aria-label={`Избранное: ${favoritesCount}`}><Icon name="heart" size={21}/>{favoritesCount > 0 && <span>{favoritesCount}</span>}</button></header>
 <main ref={mainRef} tabIndex={-1} key={`${section}/${id ?? ''}`}>
 {id ? item ? <DetailPage item={item} saved={favorites.includes(item.id)} toggle={toggle} goBack={() => navigate(section)}/> : <EmptyState title="Карточка не найдена" text="Возможно, ссылка устарела. Посмотрите свежую подборку." action="На главную" onAction={() => navigate('home')}/> : section === 'home' ? <HomePage {...actions} city={city} items={cityItems} user={user} navigate={navigate}/> : section === 'profile' ? <ProfilePage user={user} theme={theme} setTheme={setTheme} favoritesCount={favoritesCount} openFavorites={() => navigate('favorites')}/> : section === 'favorites' ? <FavoritesPage {...actions} items={cityItems} goBack={goBack} explore={() => navigate('events')}/> : <CatalogPage key={section} kind={section} items={cityItems} {...actions}/>}
 <footer className="content-footer"><span className="footer-flower">✳</span> Для тех, кто любит свой город.<small>Демонстрационные данные: места, адреса, события, услуги и рейтинги вымышлены и не являются реальными предложениями Енисейска.</small></footer>
 </main>{storageError && <div role="status" className="storage-warning">Браузер запретил сохранение. Избранное доступно до закрытия приложения.</div>}<Navigation section={section} navigate={navigate}/>{cityPickerOpen && <CityPicker city={city} selectCity={selectCity} storageError={cityStorageError} onDismiss={() => setCityPickerOpen(false)}/>}</div>;
}
