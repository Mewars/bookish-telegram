import { useEffect, useState } from 'react';
import type { Section } from '../types';
import {catalogHash,detailHash,hashParts,isCatalogSection,readCatalogFilters,routeCity,safeCatalogReturn,type CatalogFilters} from '../navigation/catalogRoute';
const sections: Section[] = ['friends', 'community', 'classifieds', 'home', 'events', 'places', 'services', 'profile', 'favorites', 'login', 'consent', 'privacy', 'cookies', 'terms', 'contacts', 'add-organization', 'my-applications', 'organization-consent', 'admin', 'admin-preview', 'photo-admin'];
export function getRoute() {
 const hash=window.location.hash;
 const {section,id,valid}=hashParts(hash);
 // Detail IDs are supported only on public catalog routes. A crafted
 // #/admin/place-id must not render a public card with an admin back target.
 const allowed=valid && sections.includes(section as Section) && (!id||isCatalogSection(section));
 return {section:allowed?section as Section:'home' as Section,id:allowed?id:undefined,
   requestedCity:routeCity(hash),filters:readCatalogFilters(hash)};
}
// A repeated click on the logo used to do nothing: the hash never changed,
// so App's route-change scroll effect was not triggered. Explicitly return to
// the top whenever Home is requested, including while already on Home.
export function navigateToRoute(section: Section, id?: string, city='') {
 const publicCity=city && (section==='home'||isCatalogSection(section));
 const nextHash = id && isCatalogSection(section)
  ? detailHash(section,id,city,window.location.hash)
  : `#/${section}${publicCity?'?'+new URLSearchParams({city}).toString():''}`;
 if (section === 'home' || window.location.hash === nextHash) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
 }
 if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

export function returnToCatalog(kind:'places'|'events'|'services',city:string) {
 window.location.hash=safeCatalogReturn(window.location.hash,kind,city);
}
export function updateCatalogFilters(kind:'places'|'events'|'services',city:string,filters:CatalogFilters) {
 // Replacing search/filter edits avoids one history entry per keystroke.
 // Opening a card still uses native hash navigation, preserving Back/Forward.
 const next=catalogHash(kind,city,filters);
 window.history.replaceState(window.history.state,'',next);
 window.dispatchEvent(new HashChangeEvent('hashchange'));
}
export function ensureRouteCity(city:string) {
 const hash=window.location.hash || '#/home';
 const {section}=hashParts(hash);
 // Login/OAuth and other private fragments retain their existing contract.
 if(section!=='home'&&!isCatalogSection(section))return;
 const [path,search='']=hash.split('?');
 const params=new URLSearchParams(search);
 if(params.get('city')===city)return;
 params.set('city',city);
 window.history.replaceState(window.history.state,'',path+'?'+params.toString());
 window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute() {
 const [route, setRoute] = useState(getRoute);
 useEffect(() => { const sync = () => setRoute(getRoute()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
 return { ...route, navigate: navigateToRoute,returnToCatalog,updateCatalogFilters,ensureRouteCity };
}
