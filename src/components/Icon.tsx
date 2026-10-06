export type IconName = 'home' | 'events' | 'places' | 'services' | 'profile' | 'search' | 'heart' | 'arrow' | 'back' | 'close' | 'sun' | 'moon' | 'pin' | 'star' | 'clock';
const paths: Record<IconName, string> = {
 home: 'm3 10 9-7 9 7v10H7V10m3 10v-6h4v6', events: 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14m-10 4h2m2 0h2m-6 3h2',
 places: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 services: 'm14 3-2 6 5 2 4-4c2 7-5 11-9 7l-6 6-3-3 6-6C5 6 9 2 14 3Z', profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
 search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6', heart: 'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z',
 arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'm14 5-7 7 7 7', close: 'm6 6 12 12M6 18 18 6', sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
 moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z', pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0m-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0', star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v5l4 2',
};
export function Icon({ name, size = 22, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
