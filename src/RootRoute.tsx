import { lazy, Suspense, useSyncExternalStore } from 'react';
import { OrganizationImportPage } from './pages/OrganizationImportPage';
import { isOrganizationImportRoute } from './import/route';
// Do not initialize Supabase or public providers on a direct importer visit.
const PublicApplication = lazy(() => import('./PublicApplication'));
function subscribeRoute(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
export function RootRoute() {
  const importing = useSyncExternalStore(subscribeRoute, isOrganizationImportRoute);
  return importing ? <OrganizationImportPage/> : <Suspense fallback={<p role="status">Загружаем Рядом…</p>}><PublicApplication/></Suspense>;
}
