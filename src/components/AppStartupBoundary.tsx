import { Component, type ReactNode } from 'react';
import './appStartup.css';

// A failed lazy import must replace Suspense's indicator with an actionable state.
export class AppStartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="app-startup-error" role="alert">
      <h1>Не удалось загрузить сайт</h1>
      <p>Проверьте соединение и попробуйте обновить страницу.</p>
      <button onClick={() => window.location.reload()}>Повторить загрузку</button>
    </section>;
    return this.props.children;
  }
}
