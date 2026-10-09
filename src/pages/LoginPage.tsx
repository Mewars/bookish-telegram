import { hasCurrentPersonalDataConsent, savePersonalDataConsent } from '../privacy/personalDataConsent';
import '../privacy/personalDataConsent.css';
import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { identityProviders } from '../auth/providers';
import { useAuth } from '../hooks/useAuth';
export function LoginPage({ goBack, openProfile }: { goBack: () => void; openProfile: () => void }) {
  const { state, error } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pdConsent, setPdConsent] = useState(hasCurrentPersonalDataConsent);
  const [consentError, setConsentError] = useState<string | null>(null);
  const starting = useRef(false);
  const startYandex = async () => {
    if (starting.current || state.status === 'loading') return;
    if (!pdConsent) {
      setConsentError('Для создания учетной записи необходимо дать отдельное согласие на обработку персональных данных.');
      return;
    }
    if (!supabase) { setLoginError('Вход через Яндекс пока недоступен: подключение Supabase не настроено.'); return; }
    if (!savePersonalDataConsent()) {
      setConsentError('Не удалось сохранить подтверждение согласия. Разрешите локальное хранение данных в браузере и попробуйте ещё раз.');
      return;
    }
    setConsentError(null);
    starting.current = true; setRedirecting(true); setLoginError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'custom:yandex', options: { redirectTo: `${window.location.origin}/` },
      });
      if (oauthError) throw oauthError;
    } catch {
      setLoginError('Не удалось перейти в Яндекс. Проверьте соединение и попробуйте ещё раз.');
      starting.current = false; setRedirecting(false);
    }
  };
  if (state.status === 'authenticated') return <section className="login-card"><h1>Вы уже вошли в Рядом</h1><button className="primary-button" onClick={openProfile}>Перейти в профиль</button></section>;
  return <><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button><section className="login-card" aria-busy={state.status === 'loading' || redirecting}><BrandMark size={44}/><h1>Войти в Рядом</h1><p>Сохраняйте места и пользуйтесь своим профилем на разных устройствах.</p><label className="pd-consent-checkbox"><input type="checkbox" checked={pdConsent} onChange={event => { setPdConsent(event.target.checked); setConsentError(null); }} aria-describedby={consentError ? 'pd-consent-error' : undefined}/><span>Я даю <a href="#/consent">согласие на обработку персональных данных</a></span></label>{consentError && <p id="pd-consent-error" className="pd-consent-error" role="alert">{consentError}</p>}<div className="login-providers">{identityProviders.map(provider => <button key={provider.id} disabled={provider.status !== 'enabled' || redirecting || state.status === 'loading'} onClick={provider.id === 'yandex' ? () => { void startYandex(); } : undefined} className="login-provider"><strong>{provider.id === 'yandex' && redirecting ? 'Переходим в Яндекс…' : provider.label}{provider.status === 'coming-soon' && ' — скоро'}</strong>{provider.status === 'not-configured' && <span>Подключение настраивается</span>}</button>)}</div><p className="login-note">{state.status === 'loading' ? 'Проверяем состояние входа…' : 'Войдите через Яндекс ID или продолжите пользоваться приложением без аккаунта.'}</p>{(loginError || error) && <p role="alert">{loginError ?? error}</p>}<button className="login-guest" onClick={goBack}>Продолжить без входа <Icon name="arrow" size={17}/></button></section></>;
}
