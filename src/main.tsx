import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startYandexMetrikaTracking } from './analytics/yandexMetrika';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';
import './web.css';
startYandexMetrikaTracking();
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App/></AuthProvider></StrictMode>);
