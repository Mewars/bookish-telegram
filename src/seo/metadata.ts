import type { Item, Section } from '../types';

export const HOME_URL = 'https://ryadomcity.ru/';
export const HOME_METADATA = {
  title: 'Scarivo — городская платформа',
  description: 'Scarivo — городская платформа: места и услуги, события, объявления и общение с жителями. Твой город в одном месте.',
  canonical: HOME_URL,
};

export interface PageMetadata { title: string; description: string; canonical?: string }

const sections: Record<Section | 'import', PageMetadata> = {
  business: {title: 'Бизнесу — Scarivo', description: 'Бесплатное размещение организации в городском каталоге, помощь с оформлением и обновлением карточки.'},
  community: { title: 'Городская лента — Scarivo', description: 'Будущая городская лента новостей, вопросов и обсуждений жителей.' },
  classifieds: { title: 'Объявления — Scarivo', description: 'Будущая городская площадка объявлений и переписки жителей.' },
  home: HOME_METADATA,
  places: { title: 'Места и достопримечательности Енисейска — Scarivo', description: 'Музеи, исторические места, парки и кафе Енисейска. Знакомьтесь с городом, ищите адреса и сохраняйте интересные места в сервисе Scarivo.' },
  events: { title: 'Афиша Енисейска — Scarivo', description: 'Раздел «Афиша» городского гида Scarivo: подборки событий и идеи для досуга в Енисейске.' },
  friends: { title: 'Друзья на карте — Scarivo', description: 'Приглашения знакомых и добровольный показ приблизительного местоположения друзьям.' },
  services: { title: 'Услуги рядом в Енисейске — Scarivo', description: 'МФЦ, почтовые отделения и полезные городские услуги Енисейска с адресами и источниками.' },
  favorites: { title: 'Избранное — Scarivo', description: 'Ваши сохранённые места, события и услуги в сервисе Scarivo.' },
  profile: { title: 'Профиль — Scarivo', description: 'Аккаунт и настройки городского гида Scarivo.' },
  login: { title: 'Вход и регистрация — Scarivo', description: 'Вход в аккаунт Scarivo, регистрация и восстановление пароля.' },
  consent: { title: 'Согласие на обработку персональных данных — Scarivo', description: 'Согласие на обработку персональных данных пользователей Scarivo.' },
  privacy: { title: 'Политика обработки персональных данных — Scarivo', description: 'Информация об обработке и защите персональных данных в сервисе Scarivo.' },
  cookies: { title: 'Политика cookie — Scarivo', description: 'Использование cookie и хранения данных в браузере на сайте Scarivo.' },
  terms: { title: 'Пользовательское соглашение — Scarivo', description: 'Условия использования городского гида Scarivo.' },
  'publication-consent': { title: 'Согласие на распространение персональных данных — Scarivo', description: 'Отдельные правила разрешения публичного распространения персональных данных.' },
  'ads-consent': { title: 'Согласие на рекламные рассылки — Scarivo', description: 'Отдельное согласие на рекламные сообщения и порядок отказа.' },
  'paid-services': { title: 'Платные услуги — Scarivo', description: 'Информация о статусе платных услуг и будущих условиях оформления заказов.' },
  contacts: { title: 'Контакты владельца — Scarivo', description: 'Контакты владельца сервиса Scarivo: почта, сайт и ВКонтакте.' },
  admin: { title: 'Управление организациями — Scarivo', description: 'Закрытая административная панель каталога.' },
  'admin-preview': { title: 'Демо админки — Scarivo', description: 'Тестовый просмотр интерфейса без подключения к базе данных.' },
  'photo-admin': { title: 'Загрузка фотографий организаций — Scarivo', description: 'Закрытый редактор фотографий городского каталога.' },
  'add-organization': { title: 'Добавить организацию — Scarivo', description: 'Заявка на размещение организации в каталоге Scarivo с предварительной проверкой сведений.' },
  'my-applications': { title: 'Мои заявки — Scarivo', description: 'Ваши заявки на размещение организаций и результаты рассмотрения.' },
  'organization-consent': { title: 'Согласие на обработку данных заявки — Scarivo', description: 'Отдельное согласие на обработку сведений заявки на размещение организации.' },
  import: { title: 'Импорт организаций — Scarivo', description: 'Служебный инструмент подготовки данных организаций для Scarivo.' },
};

// Hash screens have no independent HTML URL. Do not invent per-card canonicals.
export function pageMetadata(section: Section | 'import', id?: string, item?: Item, city = 'Енисейск'): PageMetadata {
  // The hash router has no independent city URL: keep the canonical homepage
  // for the original Eniseysk index; never claim a new city's page is Eniseysk.
  if (!id && city !== 'Енисейск' && ['home','places','events','services'].includes(section)) {
    const labels: Partial<Record<Section, string>> = { home: HOME_METADATA.title, places: 'Места и организации', events: 'Афиша', services: 'Услуги' };
    return {
      title: section === 'home' ? HOME_METADATA.title : `${labels[section as Section]} — ${city} | Scarivo`,
      description: section === 'home' ? `${city}: места и услуги, события, объявления и общение с жителями на городской платформе Scarivo.` : `Scarivo — городской справочник ${city}. Выбирайте места, организации, мероприятия и полезные услуги.`,
    };
  }
  if (id && !item) return { title: 'Карточка не найдена — Scarivo', description: 'Карточка по этой ссылке не найдена. Посмотрите места в городском гиде Scarivo.' };
  if (id && item?.real && (item.kind === 'places' || item.kind === 'services')) return {
    title: `${item.title} — ${item.city} | Scarivo`,
    description: item.description,
  };
  // Demonstration entries receive no factual card SEO or structured business data.
  if (id) return { title: sections[section].title, description: sections[section].description };
  return sections[section];
}
