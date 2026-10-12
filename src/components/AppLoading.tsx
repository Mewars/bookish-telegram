import './appStartup.css';

export function AppLoading() {
  return <div className="app-loading" role="status">
    <span className="app-loading__spinner" aria-hidden="true"/>
    <span className="app-loading__accessible-label">Загрузка приложения</span>
  </div>;
}
