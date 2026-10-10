import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RootRoute } from './RootRoute';
import { isOrganizationImportRoute } from './import/route';
import { hasAnalyticsConsent, subscribeCookieConsent } from './privacy/cookieConsent';
import { startYandexMetrikaTracking, stopYandexMetrikaTracking } from './analytics/yandexMetrika';
import './styles.css';
import './web.css';
const syncAnalyticsConsent = () => {
  if (hasAnalyticsConsent() && !isOrganizationImportRoute()) {
    // Let React close the consent panel before initializing analytics.
    window.setTimeout(() => { if (hasAnalyticsConsent() && !isOrganizationImportRoute()) startYandexMetrikaTracking(); }, 0);
  }
  else stopYandexMetrikaTracking();
};
subscribeCookieConsent(syncAnalyticsConsent);
// Suspend Webvisor before React renders any importer data, including hash navigation.
window.addEventListener('hashchange', syncAnalyticsConsent);
syncAnalyticsConsent();
createRoot(document.getElementById('root')!).render(<StrictMode><RootRoute/></StrictMode>);
