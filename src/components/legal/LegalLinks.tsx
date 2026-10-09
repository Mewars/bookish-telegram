import { CookieSettingsButton } from '../../privacy/CookieSettingsButton';
import './legal.css';
export function LegalLinks() {
  return <nav className="legal-links" aria-label="Юридическая информация"><a href="#/privacy">Политика обработки ПД</a><a href="#/consent">Согласие на обработку ПД</a><a href="#/cookies">Cookie</a><a href="#/terms">Пользовательское соглашение</a><a href="#/contacts">Контакты оператора</a><CookieSettingsButton/></nav>;
}
