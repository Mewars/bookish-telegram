import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { identityProviders } from '../auth/providers';
import { useAuth } from '../hooks/useAuth';
export function LoginPage({ goBack, openProfile }: { goBack: () => void; openProfile: () => void }) {
  const { state, error } = useAuth();
  if (state.status === 'authenticated') return <section className="login-card"><h1>Вы уже вошли в Рядом</h1><button className="primary-button" onClick={openProfile}>Перейти в профиль</button></section>;
  return <><button className="back-link" onClick={goBack}><Icon name="back" size={18}/> Назад</button><section className="login-card" aria-busy={state.status === 'loading'}><BrandMark size={44}/><h1>Войти в Рядом</h1><p>Сохраняйте места и пользуйтесь своим профилем на разных устройствах.</p><div className="login-providers">{identityProviders.map(provider => <button key={provider.id} disabled className="login-provider"><strong>{provider.label}{provider.status === 'coming-soon' && ' — скоро'}</strong>{provider.status === 'not-configured' && <span>Подключение настраивается</span>}</button>)}</div><p className="login-note">{state.status === 'loading' ? 'Проверяем состояние входа…' : 'Вход пока не подключён. Можно продолжить пользоваться приложением без аккаунта.'}</p>{error && <p role="status">{error}</p>}<button className="login-guest" onClick={goBack}>Продолжить без входа <Icon name="arrow" size={17}/></button></section></>;
}
