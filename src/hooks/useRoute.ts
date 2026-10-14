import { useEffect, useState } from 'react';
import type { Section } from '../types';
const sections: Section[] = ['home', 'events', 'places', 'services', 'profile', 'favorites', 'login', 'consent', 'privacy', 'cookies', 'terms', 'contacts', 'add-organization', 'my-applications', 'organization-consent', 'admin', 'admin-preview', 'photo-admin'];
function getRoute() {
 const [section, id] = window.location.hash.replace(/^#\/?/, '').split('/');
 return { section: sections.includes(section as Section) ? section as Section : 'home' as Section, id };
}
// A repeated click on the logo used to do nothing: the hash never changed,
// so App's route-change scroll effect was not triggered. Explicitly return to
// the top whenever Home is requested, including while already on Home.
export function navigateToRoute(section: Section, id?: string) {
 const nextHash = `#/${section}${id ? `/${id}` : ''}`;
 if (section === 'home' || window.location.hash === nextHash) {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
 }
 if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

export function useRoute() {
 const [route, setRoute] = useState(getRoute);
 useEffect(() => { const sync = () => setRoute(getRoute()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
 return { ...route, navigate: navigateToRoute };
}
