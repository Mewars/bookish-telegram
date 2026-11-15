import type { Item, Section } from '../types';

export const HOME_URL = 'https://ryadomcity.ru/';
export const HOME_METADATA = {
  title: 'Встречай — твой город в одном месте',
  description: 'Встречай — городская платформа: места и услуги, события, объявления и общение с жителями. Твой город в одном месте.',
  canonical: HOME_URL,
};

export interface PageMetadata { title: string; description: string; canonical?: string }

const sections: Record<Section | 'import', PageMetadata> = {
  business: {title: 'Бизнесу — Встречай', description: 'Бесплатное размещение организации в городском каталоге, помощь с оформлением и обновлением карточки.'},
  community: { title: 'Городская лента — Встречай', description: 'Будущая городская лента новостей, вопросов и обсуждений жителей.' },
  classifieds: { title: 'Объявления — Встречай', description: 'Будущая городская площадка объявлений и переписки жителей.' },
  home: HOME_METADATA,
  places: { title: 'Места и достопримечательности Енисейска — Встречай', description: 'Музеи, исторические места, парки и кафе Енисейска. Знакомьтесь с городом, ищите адреса и сохраняйте интересные места в сервисе Встречай.' },
  events: { title: 'Афиша Енисейска — Встречай', description: 'Раздел «Афиша» городского гида Встречай: подборки событий и идеи для досуга в Енисейске.' },
  friends: { title: 'Друзья на карте — Встречай', description: 'Приглашения знакомых и добровольный показ приблизительного местоположения друзьям.' },
  services: { title: 'Услуги рядом в Енисейске — Встречай', description: 'МФЦ, почтовые отделения и полезные городские услуги Енисейска с адресами и источниками.' },
  favorites: { title: 'Избранное — Встречай', description: 'Ваши сохранённые места, события и услуги в сервисе Встречай.' },
  profile: { title: 'Профиль — Встречай', description: 'Аккаунт и настройки городского гида Встречай.' },
  login: { title: 'Вход и регистрация — Встречай', description: 'Вход в аккаунт Встречай, регистрация и восстановление пароля.' },
  consent: { title: 'Согласие на обработку персональных данных — Встречай', description: 'Согласие на обработку персональных данных пользователей Встречай.' },
  privacy: { title: 'Политика обработки персональных данных — Встречай', description: 'Информация об обработке и защите персональных данных в сервисе Встречай.' },
  cookies: { title: 'Политика cookie — Встречай', description: 'Использование cookie и хранения данных в браузере на сайте Встречай.' },
  terms: { title: 'Пользовательское соглашение — Встречай', description: 'Условия использования городского гида Встречай.' },
  'publication-consent': { title: 'Согласие на распространение персональных данных — Встречай', description: 'Отдельные правила разрешения публичного распространения персональных данных.' },
  'ads-consent': { title: 'Согласие на рекламные рассылки — Встречай', description: 'Отдельное согласие на рекламные сообщения и порядок отказа.' },
  'paid-services': { title: 'Платные услуги — Встречай', description: 'Информация о статусе платных услуг и будущих условиях оформления заказов.' },
  contacts: { title: 'Контакты владельца — Встречай', description: 'Контакты владельца сервиса Встречай: почта, сайт и ВКонтакте.' },
  admin: { title: 'Управление организациями — Встречай', description: 'Закрытая административная панель каталога.' },
  'admin-preview': { title: 'Демо админки — Встречай', description: 'Тестовый просмотр интерфейса без подключения к базе данных.' },
  'photo-admin': { title: 'Загрузка фотографий организаций — Встречай', description: 'Закрытый редактор фотографий городского каталога.' },
  'add-organization': { title: 'Добавить организацию — Встречай', description: 'Заявка на размещение организации в каталоге Встречай с предварительной проверкой сведений.' },
  'my-applications': { title: 'Мои заявки — Встречай', description: 'Ваши заявки на размещение организаций и результаты рассмотрения.' },
  'organization-consent': { title: 'Согласие на обработку данных заявки — Встречай', description: 'Отдельное согласие на обработку сведений заявки на размещение организации.' },
  import: { title: 'Импорт организаций — Встречай', description: 'Служебный инструмент подготовки данных организаций для Встречай.' },
};

// Hash screens have no independent HTML URL. Do not invent per-card canonicals.
export function pageMetadata(section: Section | 'import', id?: string, item?: Item, city = 'Енисейск'): PageMetadata {
  // The hash router has no independent city URL: keep the canonical homepage
  // for the original Eniseysk index; never claim a new city's page is Eniseysk.
  if (!id && city !== 'Енисейск' && ['home','places','events','services'].includes(section)) {
    const labels: Partial<Record<Section, string>> = { home: HOME_METADATA.title, places: 'Места и организации', events: 'Афиша', services: 'Услуги' };
    return {
      title: section === 'home' ? HOME_METADATA.title : `${labels[section as Section]} — ${city} | Встречай`,
      description: section === 'home' ? `${city}: места и услуги, события, объявления и общение с жителями на городской платформе Встречай.` : `Встречай — городской справочник ${city}. Выбирайте места, организации, мероприятия и полезные услуги.`,
    };
  }
  if (id && !item) return { title: 'Карточка не найдена — Встречай', description: 'Карточка по этой ссылке не найдена. Посмотрите места в городском гиде Встречай.' };
  if (id && item?.real && (item.kind === 'places' || item.kind === 'services')) return {
    title: `${item.title} — ${item.city} | Встречай`,
    description: item.description,
  };
  // Demonstration entries receive no factual card SEO or structured business data.
  if (id) return { title: sections[section].title, description: sections[section].description };
  return sections[section];
}
