import type { Item, Section } from '../types';

export const HOME_URL = 'https://ryadomcity.ru/';
export const HOME_METADATA = {
  title: 'Рядом — городской гид по Енисейску: места и достопримечательности',
  description: 'Рядом — городской гид по Енисейску. Открывайте интересные места, достопримечательности и идеи для прогулок. Узнавайте город по-новому.',
  canonical: HOME_URL,
};

export interface PageMetadata { title: string; description: string; canonical?: string }

const sections: Record<Section | 'import', PageMetadata> = {
  home: HOME_METADATA,
  places: { title: 'Места и достопримечательности Енисейска — Рядом', description: 'Музеи, исторические места, парки и кафе Енисейска. Знакомьтесь с городом, ищите адреса и сохраняйте интересные места в Рядом.' },
  events: { title: 'Афиша Енисейска — Рядом', description: 'Раздел «Афиша» городского гида Рядом: подборки событий и идеи для досуга в Енисейске.' },
  services: { title: 'Услуги рядом в Енисейске — Рядом', description: 'Раздел услуг городского гида Рядом. Просматривайте категории и находите полезные идеи для повседневных дел в Енисейске.' },
  favorites: { title: 'Избранное — Рядом', description: 'Ваши сохранённые места, события и услуги в Рядом.' },
  profile: { title: 'Профиль — Рядом', description: 'Аккаунт и настройки городского гида Рядом.' },
  login: { title: 'Вход и регистрация — Рядом', description: 'Вход в аккаунт Рядом, регистрация и восстановление пароля.' },
  consent: { title: 'Согласие на обработку персональных данных — Рядом', description: 'Согласие на обработку персональных данных пользователей Рядом.' },
  privacy: { title: 'Политика обработки персональных данных — Рядом', description: 'Информация об обработке и защите персональных данных в Рядом.' },
  cookies: { title: 'Политика cookie — Рядом', description: 'Использование cookie и хранения данных в браузере на сайте Рядом.' },
  terms: { title: 'Пользовательское соглашение — Рядом', description: 'Условия использования городского гида Рядом.' },
  contacts: { title: 'Контакты оператора — Рядом', description: 'Контактная информация оператора сервиса Рядом.' },
  import: { title: 'Импорт организаций — Рядом', description: 'Служебный инструмент подготовки данных организаций для Рядом.' },
};

// Hash screens have no independent HTML URL. Do not invent per-card canonicals.
export function pageMetadata(section: Section | 'import', id?: string, item?: Item): PageMetadata {
  if (id && !item) return { title: 'Карточка не найдена — Рядом', description: 'Карточка по этой ссылке не найдена. Посмотрите места в городском гиде Рядом.' };
  if (id && item?.real && item.kind === 'places') return {
    title: `${item.title} — ${item.city} | Рядом`,
    description: item.description,
  };
  // Demonstration entries receive no factual card SEO or structured business data.
  if (id) return { title: sections[section].title, description: sections[section].description };
  return sections[section];
}
