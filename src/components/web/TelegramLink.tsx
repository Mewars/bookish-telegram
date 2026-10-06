import { Icon } from '../Icon';

export function TelegramLink({ className = '' }: { className?: string }) {
  return <a className={`telegram-link ${className}`} href="https://t.me/ryadom_city_bot" target="_blank" rel="noopener noreferrer">Открыть в Telegram <Icon name="arrow" size={17}/></a>;
}
