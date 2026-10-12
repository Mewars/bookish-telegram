import './appStartup.css';

export function AppLoading() {
  return <div className="app-loading" role="status">
    <span className="app-loading__mark" aria-hidden="true">
      <span className="app-loading__shadow"/>
      <img className="app-loading__pin" src={`${import.meta.env.BASE_URL}brand/pin-yellow.svg`} width={42} height={49} alt=""/>
    </span>
    <span className="app-loading__accessible-label">Загрузка приложения</span>
  </div>;
}
