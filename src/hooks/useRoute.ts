import { useEffect, useState } from 'react';
import type { Section } from '../types';
const sections: Section[] = ['home', 'events', 'places', 'services', 'profile', 'favorites', 'login', 'consent', 'privacy', 'cookies', 'terms', 'contacts'];
function getRoute() {
 const [section, id] = window.location.hash.replace(/^#\/?/, '').split('/');
 return { section: sections.includes(section as Section) ? section as Section : 'home' as Section, id };
}
export function useRoute() {
 const [route, setRoute] = useState(getRoute);
 useEffect(() => { const sync = () => setRoute(getRoute()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
 const navigate = (section: Section, id?: string) => { window.location.hash = `/${section}${id ? `/${id}` : ''}`; };
 return { ...route, navigate };
}
