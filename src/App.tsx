import { CityWeather } from './weather/CityWeather';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { TermsPage } from './pages/TermsPage';
import { OperatorContactsPage } from './pages/OperatorContactsPage';
import { ConsentPage } from './pages/ConsentPage';
import { CookieBanner } from './privacy/CookieBanner';
import { SiteUpdateNotice } from './components/SiteUpdateNotice';
import { MusicButton, MusicPlayer } from './music/MusicPlayer';
import { BrandWordmark } from './components/BrandWordmark';
import { HeaderUserAvatar } from './components/HeaderUserAvatar';
import { FriendsMascot } from './friends/FriendsMascot';
import { FriendsIntroDialog } from './friends/FriendsIntroDialog';
import { AccessibilityButton, AccessibilityPanel } from './accessibility/AccessibilityPanel';
import { useAccessibility } from './accessibility/useAccessibility';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
const FriendsPage=lazy(()=>import('./friends/FriendsPage').then(module=>({default:module.FriendsPage})));
import { useTheme } from './hooks/useTheme';
import { useFavorites } from './hooks/useFavorites';
import { useRoute } from './hooks/useRoute';
import { useCity } from './hooks/useCity';
import { useAvailableCities } from './hooks/useAvailableCities';
import { getCityDefinition } from './data/cities';
import { useMediaQuery } from './hooks/useMediaQuery';
import { WebHeader } from './components/web/WebHeader';
import { WebFooter } from './components/web/WebFooter';
import { WebHomePage } from './pages/WebHomePage';
import { CityPicker } from './components/CityPicker';
import { filterByCity } from './utils/city';
import { featureEnabled } from './organizations/model';
import { useOrganizations } from './organizations/useOrganizations';
import { OrganizationsPage } from './organizations/OrganizationsPage';
import { OrganizationConsentPage } from './organizations/OrganizationConsentPage';
import { AdminPage } from './admin/AdminPage';
import { AdminPreviewPage } from './admin/AdminPreviewPage';
import { PhotoAdminPage } from './photos/PhotoAdminPage';
import { useDirectoryPhotos } from './photos/useDirectoryPhotos';
import { Navigation } from './components/Navigation';
import { Icon } from './components/Icon';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ClassifiedsPage } from './classifieds/ClassifiedsPage';
import { CommunityPage } from './community/CommunityPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { DetailPage } from './pages/DetailPage';
import { EmptyState } from './components/EmptyState';
import type { Item, Section } from './types';
import { pageMetadata } from './seo/metadata';
import { isRyadomTestBackend } from './config/betaBackend';
import { usePageMetadata } from './seo/usePageMetadata';
const organizationsEnabled = featureEnabled(import.meta.env.VITE_ORGANIZATIONS_ENABLED, window.location.protocol, window.location.hostname, import.meta.env.DEV);
const adminEnabled = featureEnabled(import.meta.env.VITE_ADMIN_PANEL_ENABLED, window.location.protocol, window.location.hostname, import.meta.env.DEV);
// Separate photo editor for existing static cards; no organizations schema is required.
// Enable only AFTER the isolated Supabase migration and the owner's role are verified.
const cityDirectoryEnabled = featureEnabled(import.meta.env.VITE_CITY_DIRECTORY_ENABLED, window.location.protocol, window.location.hostname, import.meta.env.DEV);
const photoEnabled = featureEnabled(import.meta.env.VITE_CARD_PHOTOS_ENABLED, window.location.protocol, window.location.hostname, import.meta.env.DEV);
// Browser-local sandbox: public, never sends trial changes to Supabase or modifies
// production. The real role-protected admin remains separately feature gated.
const adminPreviewEnabled = true;
// Never enable the classifieds beta against the production Supabase project.
const testBackend = isRyadomTestBackend(import.meta.env.VITE_SUPABASE_URL);
const classifiedsBeta = import.meta.env.VITE_CLASSIFIEDS_ENABLED === 'true' && testBackend;
// Community content is strictly isolated from the production Supabase database.
const friendsEnabled = import.meta.env.VITE_FRIENDS_ENABLED === 'true' && (testBackend || (import.meta.env.VITE_FRIENDS_BACKEND === 'host' && import.meta.env.VITE_SUPABASE_URL === 'https://cptbmepnbzogqkfhflsg.supabase.co'));
const communityBeta = import.meta.env.VITE_COMMUNITY_ENABLED === 'true' && testBackend;
const legalSections: Section[] = ['privacy', 'cookies', 'terms', 'contacts', 'organization-consent'];
export default function App() {
 const isWideScreen = useMediaQuery('(min-width: 900px)');
 const { theme, setTheme } = useTheme(!isWideScreen);
 const { preferences: accessibilityPreferences, setPreferences: setAccessibilityPreferences, reset: resetAccessibility } = useAccessibility();
 const [accessibilityOpen, setAccessibilityOpen] = useState(false);
 const isDesktopWeb = isWideScreen;
 const { favorites, toggle, storageError, syncing, syncError, retry } = useFavorites();
 const { section, id, navigate } = useRoute();
 const isLegalPage = legalSections.includes(section);
 const legalOrigin = useRef<{ section: Section; id?: string }>({ section: 'home' });
 useEffect(() => { if (!isLegalPage) legalOrigin.current = { section, id }; }, [section, id, isLegalPage]);
 const goLegalBack = () => navigate(legalOrigin.current.section, legalOrigin.current.id);
 const { cities, ready: citiesReady, refreshCities } = useAvailableCities(cityDirectoryEnabled);
 const { city, selectCity, storageError: cityStorageError } = useCity(cities, citiesReady);
 const cityProfile = getCityDefinition(city, cities);
 const [cityPickerOpen, setCityPickerOpen] = useState(false);
 const [friendsIntroOpen, setFriendsIntroOpen] = useState(false);
 const openFriendsIntro = () => { if (friendsEnabled) setFriendsIntroOpen(true); };
 const organizationCatalog = useOrganizations(organizationsEnabled || adminEnabled);
 const photoCatalog = useDirectoryPhotos(organizationCatalog.items, photoEnabled);
 const cityItems = filterByCity(photoCatalog.items, city);
 const favoritesCount = cityItems.filter(entry => favorites.includes(entry.id)).length;
 const mainRef = useRef<HTMLElement>(null);
 const item = id ? cityItems.find(x => x.id === id) : undefined;
 usePageMetadata(pageMetadata(section, id, item, city));
 // Card links always carry the item's real catalog section, not the home screen.
 // Thus a card opened from Home returns to its catalogue rather than Home.
 const open = (entry: Item) => navigate(entry.kind, entry.id);
 const actions = { favorites, toggle, open, favoritesBusy: syncing };
 const goBack = () => navigate(section === 'favorites' ? 'profile' : section);
 useEffect(() => { window.scrollTo({ top: 0 }); mainRef.current?.focus({ preventScroll: true }); }, [section, id]);
 useEffect(() => {
  const callback = () => { if (cityPickerOpen) { setCityPickerOpen(false); return; } if (isLegalPage) { const origin = legalOrigin.current; window.location.hash = `/${origin.section}${origin.id ? `/${origin.id}` : ''}`; return; } window.location.hash = `/${section === 'consent' ? 'login' : section === 'add-organization' ? 'places' : id ? section : 'profile'}`; };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && id && !cityPickerOpen) callback(); };
  window.addEventListener('keydown', escape);
  return () => { window.removeEventListener('keydown', escape); };
 }, [id, section, cityPickerOpen, isLegalPage]);
 return <div className={`app-shell ${isDesktopWeb ? 'desktop-web' : 'compact-app'}`} data-section={section} data-mode="browser">{isDesktopWeb ? <WebHeader city={city} section={section} navigate={navigate} friendsEnabled={friendsEnabled} openFriendsIntro={openFriendsIntro} cityPickerOpen={cityPickerOpen} openCityPicker={() => setCityPickerOpen(true)}/> : <header className="app-header"><button className="brand brand-logo-pin" onClick={() => navigate('home')} aria-label="Рядом — на главную"><BrandWordmark decorative/></button><div className="header-city-weather"><button className="city-pill" onClick={() => setCityPickerOpen(true)} aria-label={`Выбрать город: ${city}`} aria-haspopup="dialog" aria-expanded={cityPickerOpen}><Icon name="pin" size={14}/><span>{city}</span><span className="city-chevron" aria-hidden="true"><Icon name="back" size={12}/></span></button><CityWeather key={city} city={city}/></div><MusicButton/>{friendsEnabled && <button type="button" className="header-friends" onClick={openFriendsIntro} aria-label="Друзья рядом — узнать о разделе" aria-haspopup="dialog"><FriendsMascot size={32}/></button>}<button className="web-profile-button header-profile-button" onClick={() => navigate('profile')} aria-label="Открыть профиль"><HeaderUserAvatar/></button></header>}
 <main ref={mainRef} tabIndex={-1} key={`${section}/${id ?? ''}`}>
 {id ? item ? <DetailPage favoritesBusy={syncing} item={item} saved={favorites.includes(item.id)} toggle={toggle} goBack={() => navigate(item.kind)} desktop={isDesktopWeb} relatedItems={cityItems} favorites={favorites} openRelated={open}/> : <EmptyState title="Карточка не найдена" text="Возможно, ссылка устарела. Посмотрите свежую подборку." action="На главную" onAction={() => navigate('home')}/> : section === 'home' ? isDesktopWeb ? <WebHomePage openFriends={friendsEnabled ? openFriendsIntro : undefined} key={city} {...actions} city={city} cityProfile={cityProfile} items={cityItems} navigate={navigate}/> : <HomePage openFriends={friendsEnabled ? openFriendsIntro : undefined} key={city} {...actions} city={city} cityProfile={cityProfile} items={cityItems} navigate={navigate}/> : section === 'privacy' ? <PrivacyPolicyPage goBack={goLegalBack}/> : section === 'cookies' ? <CookiePolicyPage goBack={goLegalBack}/> : section === 'terms' ? <TermsPage goBack={goLegalBack}/> : section === 'contacts' ? <OperatorContactsPage goBack={goLegalBack}/> : section === 'admin' ? <AdminPage enabled={adminEnabled} cityDirectoryEnabled={cityDirectoryEnabled} cities={cities} refreshCities={refreshCities} goHome={() => navigate('home')} openLogin={() => navigate('login')}/> : section === 'photo-admin' ? <PhotoAdminPage enabled={photoEnabled} goHome={() => navigate('home')} openLogin={() => navigate('login')}/> : section === 'admin-preview' ? adminPreviewEnabled ? <AdminPreviewPage goHome={() => navigate('home')}/> : <EmptyState title="Демо доступно только в тестовой версии" text="Реальный кабинет администратора защищён и появится после настройки Supabase." action="На главную" onAction={() => navigate('home')}/> : section === 'organization-consent' ? organizationsEnabled ? <OrganizationConsentPage/> : <EmptyState title="Приём заявок пока не открыт" text="Каталог продолжает работать." action="К местам" onAction={() => navigate('places')}/> : section === 'add-organization' || section === 'my-applications' ? <OrganizationsPage enabled={organizationsEnabled} mode={section === 'add-organization' ? 'add' : 'list'} city={city} goBack={() => navigate(section === 'my-applications' ? 'profile' : 'places')} openLogin={() => navigate('login')} openApplications={() => navigate('my-applications')}/> : section === 'consent' ? <ConsentPage goBack={() => navigate('login')}/> : section === 'login' ? <LoginPage goBack={() => navigate('home')} openProfile={() => navigate('profile')}/> : section === 'friends' ? friendsEnabled ? <Suspense fallback={<p role="status">Загружаем друзей…</p>}><FriendsPage city={city} openLogin={() => navigate('login')}/></Suspense> : <EmptyState title="Друзья рядом готовятся" text="Приватная карта доступна только в закрытой тестовой версии." action="На главную" onAction={() => navigate('home')}/> : section === 'community' ? communityBeta ? <CommunityPage key={city} city={city} openLogin={() => navigate('login')}/> : <EmptyState title="Городская лента готовится" text="Новости и публикации жителей проверяются в отдельной тестовой базе." action="На главную" onAction={() => navigate('home')}/> : section === 'classifieds' ? classifiedsBeta ? <ClassifiedsPage key={city} city={city} openLogin={() => navigate('login')}/> : <EmptyState title="Объявления готовятся" text="Раздел пока проверяется в отдельной тестовой базе." action="На главную" onAction={() => navigate('home')}/> : section === 'profile' ? <ProfilePage openFriends={friendsEnabled ? openFriendsIntro : undefined} openCommunity={communityBeta ? () => navigate('community') : undefined} openClassifieds={classifiedsBeta ? () => navigate('classifieds') : undefined} openAdmin={adminEnabled ? () => navigate('admin') : undefined} openPhotoAdmin={photoEnabled ? () => navigate('photo-admin') : undefined} openApplications={organizationsEnabled ? () => navigate('my-applications') : undefined} city={city} openLogin={() => navigate('login')} theme={theme} setTheme={setTheme} allowThemeSelection={isWideScreen} favoritesCount={favoritesCount} openFavorites={() => navigate('favorites')}/> : section === 'favorites' ? <FavoritesPage {...actions} items={cityItems} goBack={goBack} explore={() => navigate('places')}/> : <CatalogPage addOrganization={organizationsEnabled && section === 'places' ? () => navigate('add-organization') : undefined} catalogStatus={organizationsEnabled || adminEnabled ? organizationCatalog.status : undefined} retryCatalog={organizationCatalog.retry} key={section} kind={section} items={cityItems} {...actions}/>}

 </main><WebFooter city={city} region={cityProfile?.region ?? ''} navigate={navigate}/>{(syncError || storageError) && <div role="status" className="storage-warning">{syncError ?? 'Браузер запретил локальное сохранение избранного.'}{syncError && <button onClick={retry}>Повторить</button>}</div>}{!isDesktopWeb && <Navigation section={section} navigate={navigate}/>}<MusicPlayer/><CookieBanner/><SiteUpdateNotice/><AccessibilityButton onClick={() => setAccessibilityOpen(true)}/>
 <AccessibilityPanel open={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} preferences={accessibilityPreferences} onChange={setAccessibilityPreferences} onReset={resetAccessibility}/>{cityPickerOpen && <CityPicker city={city} cities={cities} selectCity={selectCity} storageError={cityStorageError} onDismiss={() => setCityPickerOpen(false)}/>}{friendsIntroOpen && <FriendsIntroDialog onDismiss={() => setFriendsIntroOpen(false)} onOpen={() => { setFriendsIntroOpen(false); navigate('friends'); }}/>}</div>;
}
