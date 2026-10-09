import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MusicProvider } from './music/MusicProvider';
import App from './App';
import { hasAnalyticsConsent, subscribeCookieConsent } from './privacy/cookieConsent';
import { startYandexMetrikaTracking, stopYandexMetrikaTracking } from './analytics/yandexMetrika';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';
import './web.css';
const syncAnalyticsConsent = () => {
  if (hasAnalyticsConsent()) {
    // Let React close the consent panel before initializing analytics.
    window.setTimeout(() => { if (hasAnalyticsConsent()) startYandexMetrikaTracking(); }, 0);
  }
  else stopYandexMetrikaTracking();
};
subscribeCookieConsent(syncAnalyticsConsent);
if (hasAnalyticsConsent()) startYandexMetrikaTracking();
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><MusicProvider><App/></MusicProvider></AuthProvider></StrictMode>);
