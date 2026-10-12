import { lazy, Suspense, useSyncExternalStore } from 'react';
import { OrganizationImportPage } from './pages/OrganizationImportPage';
import { isOrganizationImportRoute } from './import/route';
import { AppLoading } from './components/AppLoading';
import { AppStartupBoundary } from './components/AppStartupBoundary';
import { loadWithTimeout } from './utils/loadWithTimeout';
// Do not initialize Supabase or public providers on a direct importer visit.
const PublicApplication = lazy(() => loadWithTimeout(() => import('./PublicApplication')));
function subscribeRoute(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
export function RootRoute() {
  const importing = useSyncExternalStore(subscribeRoute, isOrganizationImportRoute);
  return importing ? <OrganizationImportPage/> : <AppStartupBoundary><Suspense fallback={<AppLoading/>}><PublicApplication/></Suspense></AppStartupBoundary>;
}
