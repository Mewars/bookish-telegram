import { lazy, Suspense, useSyncExternalStore } from 'react';
import { isOrganizationImportRoute } from './import/route';
import { AppLoading } from './components/AppLoading';
import { AppStartupBoundary } from './components/AppStartupBoundary';
import { loadWithTimeout } from './utils/loadWithTimeout';
// Do not initialize Supabase or public providers on a direct importer visit.
const OrganizationImportPage = lazy(() => loadWithTimeout(() => import('./pages/OrganizationImportPage')).then(module=>({default:module.OrganizationImportPage})));
const PublicApplication = lazy(() => loadWithTimeout(() => import('./PublicApplication')));
function subscribeRoute(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
export function RootRoute() {
  const importing = useSyncExternalStore(subscribeRoute, isOrganizationImportRoute);
  return <AppStartupBoundary><Suspense fallback={<AppLoading/>}>{importing ? <OrganizationImportPage/> : <PublicApplication/>}</Suspense></AppStartupBoundary>;
}
