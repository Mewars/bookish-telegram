import type { Item, Section } from '../types';

export const HOME_URL = 'https://ryadomcity.ru/';
export const HOME_METADATA = {
  title: 'Рядом — городской гид по Енисейску: места и достопримечательности',
  description: 'Рядом — городской гид по Енисейску. Открывайте интересные места, достопримечательности и идеи для прогулок. Узнавайте город по-новому.',
  canonical: HOME_URL,
};

export interface PageMetadata { title: string; description: string; canonical?: string }

const sections: Record<Section | 'import', PageMetadata> = {
  community: { title: 'Городская лента — Рядом', description: 'Будущая городская лента новостей, вопросов и обсуждений жителей.' },
  classifieds: { title: 'Объявления — Рядом', description: 'Будущая городская площадка объявлений и переписки жителей.' },
  home: HOME_METADATA,
  places: { title: 'Места и достопримечательности Енисейска — Рядом', description: 'Музеи, исторические места, парки и кафе Енисейска. Знакомьтесь с городом, ищите адреса и сохраняйте интересные места в Рядом.' },
  events: { title: 'Афиша Енисейска — Рядом', description: 'Раздел «Афиша» городского гида Рядом: подборки событий и идеи для досуга в Енисейске.' },
  friends: { title: 'Друзья рядом — Рядом', description: 'Приглашения знакомых и добровольный показ приблизительного местоположения друзьям.' },
  services: { title: 'Услуги рядом в Енисейске — Рядом', description: 'МФЦ, почтовые отделения и полезные городские услуги Енисейска с адресами и источниками.' },
  favorites: { title: 'Избранное — Рядом', description: 'Ваши сохранённые места, события и услуги в Рядом.' },
  profile: { title: 'Профиль — Рядом', description: 'Аккаунт и настройки городского гида Рядом.' },
  login: { title: 'Вход и регистрация — Рядом', description: 'Вход в аккаунт Рядом, регистрация и восстановление пароля.' },
  consent: { title: 'Согласие на обработку персональных данных — Рядом', description: 'Согласие на обработку персональных данных пользователей Рядом.' },
  privacy: { title: 'Политика обработки персональных данных — Рядом', description: 'Информация об обработке и защите персональных данных в Рядом.' },
  cookies: { title: 'Политика cookie — Рядом', description: 'Использование cookie и хранения данных в браузере на сайте Рядом.' },
  terms: { title: 'Пользовательское соглашение — Рядом', description: 'Условия использования городского гида Рядом.' },
  contacts: { title: 'Контакты владельца — Рядом', description: 'Контакты владельца сервиса Рядом: почта, сайт и ВКонтакте.' },
  admin: { title: 'Управление организациями — Рядом', description: 'Закрытая административная панель каталога.' },
  'admin-preview': { title: 'Демо админки — Рядом', description: 'Тестовый просмотр интерфейса без подключения к базе данных.' },
  'photo-admin': { title: 'Загрузка фотографий организаций — Рядом', description: 'Закрытый редактор фотографий городского каталога.' },
  'add-organization': { title: 'Добавить организацию — Рядом', description: 'Заявка на размещение организации в каталоге Рядом с предварительной проверкой сведений.' },
  'my-applications': { title: 'Мои заявки — Рядом', description: 'Ваши заявки на размещение организаций и результаты рассмотрения.' },
  'organization-consent': { title: 'Согласие на обработку данных заявки — Рядом', description: 'Отдельное согласие на обработку сведений заявки на размещение организации.' },
  import: { title: 'Импорт организаций — Рядом', description: 'Служебный инструмент подготовки данных организаций для Рядом.' },
};

// Hash screens have no independent HTML URL. Do not invent per-card canonicals.
export function pageMetadata(section: Section | 'import', id?: string, item?: Item, city = 'Енисейск'): PageMetadata {
  // The hash router has no independent city URL: keep the canonical homepage
  // for the original Eniseysk index; never claim a new city's page is Eniseysk.
  if (!id && city !== 'Енисейск' && ['home','places','events','services'].includes(section)) {
    const labels: Partial<Record<Section, string>> = { home: 'Городской гид', places: 'Места и организации', events: 'Афиша', services: 'Услуги' };
    return {
      title: `${labels[section as Section]} — ${city} | Рядом`,
      description: `Рядом — городской справочник ${city}. Выбирайте места, организации, мероприятия и полезные услуги.`,
    };
  }
  if (id && !item) return { title: 'Карточка не найдена — Рядом', description: 'Карточка по этой ссылке не найдена. Посмотрите места в городском гиде Рядом.' };
  if (id && item?.real && (item.kind === 'places' || item.kind === 'services')) return {
    title: `${item.title} — ${item.city} | Рядом`,
    description: item.description,
  };
  // Demonstration entries receive no factual card SEO or structured business data.
  if (id) return { title: sections[section].title, description: sections[section].description };
  return sections[section];
}
