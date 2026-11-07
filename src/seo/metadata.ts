import type { Item, Section } from '../types';

export const HOME_URL = 'https://ryadomcity.ru/';
export const HOME_METADATA = {
  title: 'Городской портал',
  description: 'Городской портал — городской сервис: организации, места, услуги и события. Открывай город по-новому.',
  canonical: HOME_URL,
};

export interface PageMetadata { title: string; description: string; canonical?: string }

const sections: Record<Section | 'import', PageMetadata> = {
  business: {title: 'Бизнесу — Городской портал', description: 'Бесплатное размещение организации в городском каталоге, помощь с оформлением и обновлением карточки.'},
  community: { title: 'Городская лента — Городской портал', description: 'Будущая городская лента новостей, вопросов и обсуждений жителей.' },
  classifieds: { title: 'Объявления — Городской портал', description: 'Будущая городская площадка объявлений и переписки жителей.' },
  home: HOME_METADATA,
  places: { title: 'Места и достопримечательности Енисейска — Городской портал', description: 'Музеи, исторические места, парки и кафе Енисейска. Знакомьтесь с городом, ищите адреса и сохраняйте интересные места в Городской портал.' },
  events: { title: 'Афиша Енисейска — Городской портал', description: 'Раздел «Афиша» городского гида Городской портал: подборки событий и идеи для досуга в Енисейске.' },
  friends: { title: 'Друзья на карте — Городской портал', description: 'Приглашения знакомых и добровольный показ приблизительного местоположения друзьям.' },
  services: { title: 'Услуги рядом в Енисейске — Городской портал', description: 'МФЦ, почтовые отделения и полезные городские услуги Енисейска с адресами и источниками.' },
  favorites: { title: 'Избранное — Городской портал', description: 'Ваши сохранённые места, события и услуги в Городской портал.' },
  profile: { title: 'Профиль — Городской портал', description: 'Аккаунт и настройки городского гида Городской портал.' },
  login: { title: 'Вход и регистрация — Городской портал', description: 'Вход в аккаунт Городской портал, регистрация и восстановление пароля.' },
  consent: { title: 'Согласие на обработку персональных данных — Городской портал', description: 'Согласие на обработку персональных данных пользователей Городской портал.' },
  privacy: { title: 'Политика обработки персональных данных — Городской портал', description: 'Информация об обработке и защите персональных данных в Городской портал.' },
  cookies: { title: 'Политика cookie — Городской портал', description: 'Использование cookie и хранения данных в браузере на сайте Городской портал.' },
  terms: { title: 'Пользовательское соглашение — Городской портал', description: 'Условия использования городского гида Городской портал.' },
  'publication-consent': { title: 'Согласие на распространение персональных данных — Городской портал', description: 'Отдельные правила разрешения публичного распространения персональных данных.' },
  'ads-consent': { title: 'Согласие на рекламные рассылки — Городской портал', description: 'Отдельное согласие на рекламные сообщения и порядок отказа.' },
  'paid-services': { title: 'Платные услуги — Городской портал', description: 'Информация о статусе платных услуг и будущих условиях оформления заказов.' },
  contacts: { title: 'Контакты владельца — Городской портал', description: 'Контакты владельца сервиса Городской портал: почта, сайт и ВКонтакте.' },
  admin: { title: 'Управление организациями — Городской портал', description: 'Закрытая административная панель каталога.' },
  'admin-preview': { title: 'Демо админки — Городской портал', description: 'Тестовый просмотр интерфейса без подключения к базе данных.' },
  'photo-admin': { title: 'Загрузка фотографий организаций — Городской портал', description: 'Закрытый редактор фотографий городского каталога.' },
  'add-organization': { title: 'Добавить организацию — Городской портал', description: 'Заявка на размещение организации в каталоге Городской портал с предварительной проверкой сведений.' },
  'my-applications': { title: 'Мои заявки — Городской портал', description: 'Ваши заявки на размещение организаций и результаты рассмотрения.' },
  'organization-consent': { title: 'Согласие на обработку данных заявки — Городской портал', description: 'Отдельное согласие на обработку сведений заявки на размещение организации.' },
  import: { title: 'Импорт организаций — Городской портал', description: 'Служебный инструмент подготовки данных организаций для Городской портал.' },
};

// Hash screens have no independent HTML URL. Do not invent per-card canonicals.
export function pageMetadata(section: Section | 'import', id?: string, item?: Item, city = 'Енисейск'): PageMetadata {
  // The hash router has no independent city URL: keep the canonical homepage
  // for the original Eniseysk index; never claim a new city's page is Eniseysk.
  if (!id && city !== 'Енисейск' && ['home','places','events','services'].includes(section)) {
    const labels: Partial<Record<Section, string>> = { home: 'Городской портал', places: 'Места и организации', events: 'Афиша', services: 'Услуги' };
    return {
      title: section === 'home' ? 'Городской портал' : `${labels[section as Section]} — ${city} | Городской портал`,
      description: `Городской портал — городской справочник ${city}. Выбирайте места, организации, мероприятия и полезные услуги.`,
    };
  }
  if (id && !item) return { title: 'Карточка не найдена — Городской портал', description: 'Карточка по этой ссылке не найдена. Посмотрите места в городском гиде Городской портал.' };
  if (id && item?.real && (item.kind === 'places' || item.kind === 'services')) return {
    title: `${item.title} — ${item.city} | Городской портал`,
    description: item.description,
  };
  // Demonstration entries receive no factual card SEO or structured business data.
  if (id) return { title: sections[section].title, description: sections[section].description };
  return sections[section];
}
