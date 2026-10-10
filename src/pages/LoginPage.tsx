import { useRef, useState, type FormEvent } from 'react';
import { hasCurrentPersonalDataConsent, savePersonalDataConsent } from '../privacy/personalDataConsent';
import '../privacy/personalDataConsent.css';
import { supabase } from '../lib/supabase';
import { BrandWordmark } from '../components/BrandWordmark';
import { Icon } from '../components/Icon';
import { identityProviders } from '../auth/providers';
import { useAuth } from '../hooks/useAuth';

type EmailMode = 'signin' | 'signup' | 'forgot';

function accountError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'invalid_credentials': return 'Неверная почта или пароль.';
    case 'email_not_confirmed': return 'Подтвердите почту по ссылке из письма и повторите вход.';
    case 'weak_password': return 'Пароль не соответствует требованиям безопасности. Попробуйте более сложный.';
    case 'email_address_invalid': return 'Проверьте адрес электронной почты.';
    case 'signup_disabled': return 'Регистрация по email пока отключена в настройках сервиса.';
    case 'email_exists':
    case 'user_already_exists': return 'Не удалось зарегистрировать этот адрес. Попробуйте войти или восстановить пароль.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Слишком много запросов. Попробуйте позднее.';
    case 'otp_expired':
    case 'otp_disabled': return 'Ссылка устарела или недействительна. Запросите новое письмо.';
    case 'same_password': return 'Новый пароль должен отличаться от предыдущего.';
    default: return fallback;
  }
}

function loginReturnUrl(): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.hash = '/login';
  return url.href;
}

function recoveryReturnUrl(): string {
  const url = new URL(loginReturnUrl());
  url.searchParams.set('ryadom_recovery', '1');
  return url.href;
}

function clearRecoveryMarker(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('ryadom_recovery');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

export function LoginPage({ goBack, openProfile }: { goBack: () => void; openProfile: () => void }) {
  const { state, error } = useAuth();
  const [mode, setMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdConsent, setPdConsent] = useState(hasCurrentPersonalDataConsent);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(
    () => new URLSearchParams(window.location.search).get('ryadom_recovery') === '1',
  );
  const inFlight = useRef(false);
  const disabled = busy || redirecting || state.status === 'loading';

  const checkConsent = (): boolean => {
    if (!pdConsent) {
      setConsentError('Для регистрации необходимо дать отдельное согласие на обработку персональных данных.');
      return false;
    }
    if (!savePersonalDataConsent()) {
      setConsentError('Не удалось сохранить согласие. Разрешите локальное хранение данных и попробуйте снова.');
      return false;
    }
    setConsentError(null);
    return true;
  };

  const execute = async (action: () => Promise<void>) => {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    setLoginError(null);
    setNotice(null);
    try { await action(); }
    catch { setLoginError('Не удалось выполнить запрос. Проверьте соединение и попробуйте снова.'); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const changeMode = (next: EmailMode) => {
    if (disabled) return;
    setMode(next);
    setPassword('');
    setPasswordAgain('');
    setLoginError(null);
    setNotice(null);
    setConsentError(null);
  };

  const startYandex = async () => {
    if (inFlight.current || disabled || !checkConsent()) return;
    if (!supabase) { setLoginError('Вход через Яндекс недоступен: Supabase не настроен.'); return; }
    inFlight.current = true;
    setRedirecting(true);
    setLoginError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'custom:yandex',
        options: { redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
      });
      if (oauthError) throw oauthError;
    } catch {
      setLoginError('Не удалось перейти в Яндекс. Проверьте соединение и попробуйте ещё раз.');
      inFlight.current = false;
      setRedirecting(false);
    }
  };

  const submitEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void execute(async () => {
      if (!supabase) {
        setLoginError('Регистрация и вход по email пока недоступны: Supabase не настроен.');
        return;
      }
      const address = email.trim();
      if (!address) { setLoginError('Введите электронную почту.'); return; }

      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: recoveryReturnUrl(),
        });
        if (resetError) {
          setLoginError(accountError(resetError.code, 'Не удалось отправить письмо. Попробуйте позднее.'));
          return;
        }
        setNotice('Если для этого адреса доступно восстановление, придёт письмо со ссылкой.');
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: address, password,
        });
        if (signInError) {
          setLoginError(accountError(signInError.code, 'Не удалось войти. Проверьте данные и повторите попытку.'));
          return;
        }
        setPassword('');
        openProfile();
        return;
      }

      if (!checkConsent()) return;
      if (password.length < 8) {
        setLoginError('Используйте пароль не короче 8 символов.');
        return;
      }
      if (password !== passwordAgain) {
        setLoginError('Пароли не совпадают.');
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: address, password,
        options: { emailRedirectTo: loginReturnUrl() },
      });
      if (signUpError) {
        setLoginError(accountError(signUpError.code, 'Регистрация не удалась. Попробуйте позднее.'));
        return;
      }
      setPassword('');
      setPasswordAgain('');
      if (data.session) {
        openProfile();
      } else {
        setNotice('Если регистрация доступна, проверьте почту и подтвердите адрес по ссылке из письма.');
      }
    });
  };

  const submitNewPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void execute(async () => {
      if (!supabase || state.status !== 'authenticated') {
        setLoginError('Ссылка восстановления не подтверждена. Запросите новую.');
        return;
      }
      if (newPassword.length < 8) {
        setLoginError('Используйте пароль не короче 8 символов.');
        return;
      }
      if (newPassword !== newPasswordAgain) {
        setLoginError('Пароли не совпадают.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setLoginError(accountError(updateError.code, 'Не удалось изменить пароль. Попробуйте ещё раз.'));
        return;
      }
      setNewPassword('');
      setNewPasswordAgain('');
      clearRecoveryMarker();
      setRecoveryMode(false);
      openProfile();
    });
  };

  const exitRecovery = () => {
    clearRecoveryMarker();
    setRecoveryMode(false);
    changeMode('forgot');
  };

  if (recoveryMode) {
    return <><button className="back-link" onClick={exitRecovery}><Icon name="back" size={18}/> Назад</button>
      <section className="login-card" aria-busy={disabled}>
        <span className="brand brand-logo-pin login-brand" aria-label="Рядом"><BrandWordmark/></span>
        <h1>Новый пароль</h1>
        {state.status === 'authenticated'
          ? <><p>Придумайте новый пароль для своего аккаунта.</p>
            <form className="email-auth-form" onSubmit={submitNewPassword}>
              <label>Новый пароль<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)}/></label>
              <label>Повторите пароль<input type="password" autoComplete="new-password" minLength={8} required value={newPasswordAgain} onChange={event => setNewPasswordAgain(event.target.value)}/></label>
              <button className="primary-button email-auth-submit" disabled={disabled} type="submit">{busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>
            </form></>
          : <p>{state.status === 'loading' ? 'Проверяем ссылку восстановления…' : 'Ссылка восстановления не подтверждена или устарела. Запросите новое письмо.'}</p>}
        {(loginError || error) && <p className="email-auth-error" role="alert">{loginError ?? error}</p>}
        {state.status !== 'loading' && state.status !== 'authenticated' && <button className="login-guest" onClick={exitRecovery}>Запросить новую ссылку</button>}
      </section></>;
  }

  if (state.status === 'authenticated') {
    return <section className="login-card"><h1>Вы уже вошли в Рядом</h1><button className="primary-button" onClick={openProfile}>Перейти в профиль</button></section>;
  }

  return <><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button>
    <section className="login-card" aria-busy={disabled}>
      <span className="brand brand-logo-pin login-brand" aria-label="Рядом"><BrandWordmark/></span>
      <h1>{mode === 'signup' ? 'Регистрация' : mode === 'forgot' ? 'Восстановить пароль' : 'Войти в Рядом'}</h1>
      <p>{mode === 'signup' ? 'Создайте аккаунт, чтобы сохранять любимые места.' : mode === 'forgot' ? 'Укажите почту, и мы отправим ссылку для смены пароля.' : 'Сохраняйте места и пользуйтесь профилем на разных устройствах.'}</p>
      <div className="email-auth-tabs" role="group" aria-label="Способ входа">
        <button type="button" className={mode === 'signin' ? 'active' : ''} aria-pressed={mode === 'signin'} disabled={disabled} onClick={() => changeMode('signin')}>Войти</button>
        <button type="button" className={mode === 'signup' ? 'active' : ''} aria-pressed={mode === 'signup'} disabled={disabled} onClick={() => changeMode('signup')}>Регистрация</button>
      </div>
      <form className="email-auth-form" onSubmit={submitEmail}>
        <label>Электронная почта<input type="email" inputMode="email" autoComplete="email" placeholder="name@example.ru" required value={email} onChange={event => setEmail(event.target.value)} disabled={disabled}/></label>
        {mode !== 'forgot' && <label>Пароль<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required value={password} onChange={event => setPassword(event.target.value)} disabled={disabled}/></label>}
        {mode === 'signup' && <label>Повторите пароль<input type="password" autoComplete="new-password" minLength={8} required value={passwordAgain} onChange={event => setPasswordAgain(event.target.value)} disabled={disabled}/></label>}
        {mode === 'signup' && <p className="email-auth-hint">Не менее 8 символов. Используйте уникальный пароль.</p>}
        {mode === 'signup' && <label className="pd-consent-checkbox"><input type="checkbox" checked={pdConsent} onChange={event => { setPdConsent(event.target.checked); setConsentError(null); }} aria-describedby={consentError ? 'pd-consent-error' : undefined}/><span>Я даю <a href="#/consent">согласие на обработку персональных данных</a></span></label>}
        {consentError && <p id="pd-consent-error" className="pd-consent-error" role="alert">{consentError}</p>}
        <button type="submit" className="primary-button email-auth-submit" disabled={disabled}>
          {busy ? 'Выполняем…' : mode === 'signin' ? 'Войти по почте' : mode === 'signup' ? 'Зарегистрироваться' : 'Отправить письмо'}
        </button>
      </form>
      {mode === 'signin' && <button className="email-auth-link" disabled={disabled} onClick={() => changeMode('forgot')}>Забыли пароль?</button>}
      {mode === 'forgot' && <button className="email-auth-link" disabled={disabled} onClick={() => changeMode('signin')}>Вернуться ко входу</button>}
      {mode !== 'forgot' && <><div className="email-auth-separator"><span>или войдите через</span></div>
        <label className="pd-consent-checkbox"><input type="checkbox" checked={pdConsent} onChange={event => { setPdConsent(event.target.checked); setConsentError(null); }} aria-describedby={consentError ? 'pd-consent-error' : undefined}/><span>Я даю <a href="#/consent">согласие на обработку персональных данных</a> для входа через Яндекс</span></label>
        <div className="login-providers">{identityProviders.map(provider => <button key={provider.id} type="button" disabled={provider.status !== 'enabled' || disabled} onClick={provider.id === 'yandex' ? () => { void startYandex(); } : undefined} className="login-provider"><strong>{provider.id === 'yandex' && redirecting ? 'Переходим в Яндекс…' : provider.label}{provider.status === 'coming-soon' && ' — скоро'}</strong>{provider.status === 'not-configured' && <span>Подключение настраивается</span>}</button>)}</div>
      </>}
      <a className="login-policy-link" href="#/privacy">Политика обработки персональных данных</a>
      {notice && <p className="email-auth-notice" role="status">{notice}</p>}
      {(loginError || error) && <p className="email-auth-error" role="alert">{loginError ?? error}</p>}
      <button className="login-guest" disabled={disabled} onClick={goBack}>Продолжить без входа <Icon name="arrow" size={17}/></button>
    </section></>;
}
