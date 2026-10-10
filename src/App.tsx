import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { TermsPage } from './pages/TermsPage';
import { OperatorContactsPage } from './pages/OperatorContactsPage';
import { ConsentPage } from './pages/ConsentPage';
import { CookieBanner } from './privacy/CookieBanner';
import { MusicButton, MusicPlayer } from './music/MusicPlayer';
import { BrandWordmark } from './components/BrandWordmark';
import { useEffect, useRef, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useFavorites } from './hooks/useFavorites';
import { useRoute } from './hooks/useRoute';
import { useCity } from './hooks/useCity';
import { useMediaQuery } from './hooks/useMediaQuery';
import { WebHeader } from './components/web/WebHeader';
import { WebFooter } from './components/web/WebFooter';
import { WebHomePage } from './pages/WebHomePage';
import { CityPicker } from './components/CityPicker';
import { filterByCity } from './utils/city';
import { catalog } from './data/catalog';
import { Navigation } from './components/Navigation';
import { Icon } from './components/Icon';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { DetailPage } from './pages/DetailPage';
import { EmptyState } from './components/EmptyState';
import type { Item, Section } from './types';
const legalSections: Section[] = ['privacy', 'cookies', 'terms', 'contacts'];
export default function App() {
 const { user, theme, setTheme, webApp } = useTelegram();
 const isWideScreen = useMediaQuery('(min-width: 900px)');
 const isDesktopWeb = !webApp && isWideScreen;
 const { favorites, toggle, storageError, syncing, syncError, retry } = useFavorites();
 const { section, id, navigate } = useRoute();
 const isLegalPage = legalSections.includes(section);
 const legalOrigin = useRef<{ section: Section; id?: string }>({ section: 'home' });
 useEffect(() => { if (!isLegalPage) legalOrigin.current = { section, id }; }, [section, id, isLegalPage]);
 const goLegalBack = () => navigate(legalOrigin.current.section, legalOrigin.current.id);
 const { city, selectCity, storageError: cityStorageError } = useCity();
 const [cityPickerOpen, setCityPickerOpen] = useState(false);
 const cityItems = filterByCity(catalog, city);
 const favoritesCount = cityItems.filter(entry => favorites.includes(entry.id)).length;
 const mainRef = useRef<HTMLElement>(null);
 const item = id ? cityItems.find(x => x.id === id) : undefined;
 const goBack = () => navigate(section === 'favorites' ? 'profile' : section);
 const open = (entry: Item) => navigate(section, entry.id);
 const actions = { favorites, toggle, open, favoritesBusy: syncing };
 useEffect(() => { window.scrollTo({ top: 0 }); mainRef.current?.focus({ preventScroll: true }); }, [section, id]);
 useEffect(() => {
  const back = webApp?.BackButton;
  const callback = () => { if (cityPickerOpen) { setCityPickerOpen(false); return; } if (isLegalPage) { const origin = legalOrigin.current; window.location.hash = `/${origin.section}${origin.id ? `/${origin.id}` : ''}`; return; } window.location.hash = `/${section === 'consent' ? 'login' : id ? section : 'profile'}`; };
  if (cityPickerOpen || id || section === 'favorites' || section === 'consent' || isLegalPage) { back?.show(); back?.onClick(callback); }
  else back?.hide();
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && id && !cityPickerOpen) callback(); };
  window.addEventListener('keydown', escape);
  return () => { back?.offClick(callback); back?.hide(); window.removeEventListener('keydown', escape); };
 }, [id, section, webApp, cityPickerOpen, isLegalPage]);
 return <div className={`app-shell ${isDesktopWeb ? 'desktop-web' : 'compact-app'}`} data-section={section} data-mode={webApp ? 'telegram' : 'browser'}>{isDesktopWeb ? <WebHeader city={city} section={section} navigate={navigate} favoritesCount={favoritesCount} cityPickerOpen={cityPickerOpen} openCityPicker={() => setCityPickerOpen(true)}/> : <header className="app-header"><button className="brand brand-logo-pin" onClick={() => navigate('home')} aria-label="Рядом — на главную"><BrandWordmark/></button><button className="city-pill" onClick={() => setCityPickerOpen(true)} aria-label={`Выбрать город: ${city}`} aria-haspopup="dialog" aria-expanded={cityPickerOpen}><Icon name="pin" size={14}/><span>{city}</span><span className="city-chevron" aria-hidden="true"><Icon name="back" size={12}/></span></button><MusicButton/><button className="header-heart" onClick={() => navigate('favorites')} aria-label={`Избранное: ${favoritesCount}`}><Icon name="heart" size={21}/>{favoritesCount > 0 && <span>{favoritesCount}</span>}</button></header>}
 <main ref={mainRef} tabIndex={-1} key={`${section}/${id ?? ''}`}>
 {id ? item ? <DetailPage favoritesBusy={syncing} item={item} saved={favorites.includes(item.id)} toggle={toggle} goBack={() => navigate(section)} desktop={isDesktopWeb} relatedItems={cityItems} favorites={favorites} openRelated={open}/> : <EmptyState title="Карточка не найдена" text="Возможно, ссылка устарела. Посмотрите свежую подборку." action="На главную" onAction={() => navigate('home')}/> : section === 'home' ? isDesktopWeb ? <WebHomePage {...actions} city={city} items={cityItems} navigate={navigate}/> : <HomePage {...actions} city={city} items={cityItems} user={user} navigate={navigate}/> : section === 'privacy' ? <PrivacyPolicyPage goBack={goLegalBack}/> : section === 'cookies' ? <CookiePolicyPage goBack={goLegalBack}/> : section === 'terms' ? <TermsPage goBack={goLegalBack}/> : section === 'contacts' ? <OperatorContactsPage goBack={goLegalBack}/> : section === 'consent' ? <ConsentPage goBack={() => navigate('login')}/> : section === 'login' ? <LoginPage goBack={() => navigate('home')} openProfile={() => navigate('profile')}/> : section === 'profile' ? <ProfilePage city={city} openLogin={() => navigate('login')} browserMode={!webApp} user={user} theme={theme} setTheme={setTheme} favoritesCount={favoritesCount} openFavorites={() => navigate('favorites')}/> : section === 'favorites' ? <FavoritesPage {...actions} items={cityItems} goBack={goBack} explore={() => navigate('events')}/> : <CatalogPage key={section} kind={section} items={cityItems} {...actions}/>}

 </main><WebFooter city={city} navigate={navigate}/>{(syncError || storageError) && <div role="status" className="storage-warning">{syncError ?? 'Браузер запретил локальное сохранение избранного.'}{syncError && <button onClick={retry}>Повторить</button>}</div>}{!isDesktopWeb && <Navigation section={section} navigate={navigate}/>}<MusicPlayer/><CookieBanner/>{cityPickerOpen && <CityPicker city={city} selectCity={selectCity} storageError={cityStorageError} onDismiss={() => setCityPickerOpen(false)}/>}</div>;
}
