import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RootRoute } from './RootRoute';
import { isPrivateAnalyticsRoute } from './analytics/privateRoute';
import { hasAnalyticsConsent, subscribeCookieConsent } from './privacy/cookieConsent';
import { startYandexMetrikaTracking, stopYandexMetrikaTracking } from './analytics/yandexMetrika';
import './styles.css';
import { captureOAuthFailure } from './auth/oauthCallback';
captureOAuthFailure();
const syncAnalyticsConsent = () => {
  if (hasAnalyticsConsent() && !isPrivateAnalyticsRoute()) {
    // Let React close the consent panel before initializing analytics.
    window.setTimeout(() => { if (hasAnalyticsConsent() && !isPrivateAnalyticsRoute()) startYandexMetrikaTracking(); }, 0);
  }
  else stopYandexMetrikaTracking();
};
subscribeCookieConsent(syncAnalyticsConsent);
// Suspend Webvisor before React renders private data, including hash navigation.
window.addEventListener('hashchange', syncAnalyticsConsent);
syncAnalyticsConsent();
createRoot(document.getElementById('root')!).render(<StrictMode><RootRoute/></StrictMode>);
