import type { Item } from '../types';

// Reviewed public institutions only. A broad category (e.g. health or education)
// does not establish public ownership. New/unreviewed cards default to no phone.
const publicServiceIds = new Set([
  'service-mfc-eniseysk', 'service-post-663180',
  'place-ozernoe-mfc', 'place-ozernoe-post-663182',
  'place-ozernoe-administration', 'place-yandex-1820207453',
  'place-yandex-103209056458', 'place-yandex-189633852970',
  'place-yandex-156036311923', 'place-yandex-136516879292',
  'place-ozernoe-school-47', 'place-yandex-36605832528',
  'place-eniseysk-kindergarten-11', 'place-ozernoe-kindergarten-6',
  'place-central-library', 'place-childrens-library', 'place-library-branch-1',
  'place-ozernoe-library', 'place-culture-center-eniseysk',
  'place-gdk-arutyunyan', 'place-ozernoe-culture-center', 'place-kytmanov-museum',
]);

export function showsBasicPhone(item: Pick<Item, 'id' | 'kind'>): boolean {
  return item.kind !== 'events' && publicServiceIds.has(item.id);
}

// Generated from the recorded category, without claims about menus, quality,
// equipment, availability, licences or services that have not been supplied.
export function basicDescription(item: Pick<Item, 'title' | 'category'>): string {
  const category = item.category.toLocaleLowerCase('ru');
  const formats: [RegExp, string][] = [
    [/доставк.*еды/, 'доставка еды. Здесь собрана основная информация для знакомства с организацией.'],
    [/пиццери|суши/, 'заведение в категории «Пицца и суши». Адрес и режим работы помогут спланировать посещение.'],
    [/столов/, 'столовая. Основные сведения для тех, кто выбирает, где пообедать.'],
    [/бургер|стритфуд/, 'быстрое питание. Место для перекуса в городе.'],
    [/ресторан/, 'ресторан. Узнайте адрес и режим работы перед посещением.'],
    [/пекар|кондитер/, 'пекарня или кондитерская. Ориентируйтесь на адрес и график в карточке.'],
    [/бар|паб/, 'бар. Здесь собраны адрес и доступные сведения о режиме работы.'],
    [/кафе|кофейн/, 'кафе. Место для перерыва в течение дня и встреч в городе.'],
    [/гостиниц|отел|гостев|комнат|общежит|баз.*отдых/, 'место размещения. Адрес и основные сведения помогут спланировать поездку.'],
    [/мфц|госуслуг/, 'городская служба. Основная информация для подготовки к обращению.'],
    [/почт/, 'почтовое отделение. Проверьте адрес и график перед посещением.'],
    [/аптек/, 'аптека. Здесь можно посмотреть адрес и указанные часы работы.'],
    [/банк/, 'банковское обслуживание. Адрес и график помогут выбрать время для посещения.'],
    [/строительств|стройматериал|нерудн/, 'товары для строительства и ремонта. Основная информация о торговой точке.'],
    [/супермаркет|продукт/, 'продуктовый магазин. Полезная информация для повседневных покупок.'],
    [/магазин|торгов|пункт.*выдач/, 'торговая точка. Здесь собраны адрес и доступные сведения для посетителей.'],
    [/азс/, 'автозаправочная станция. Адрес поможет спланировать остановку в пути.'],
    [/авто.*сервис|техобслуж|(?:^| \/ )сто(?: |$)/, 'автосервис. Основные сведения для планирования визита.'],
    [/образован|школ|детск.*сад/, 'образовательное учреждение. Информация о местоположении и режиме работы.'],
    [/библиотек/, 'библиотека. Место для знакомства с книгами. Уточните график перед посещением.'],
    [/музе/, 'музей. Познакомьтесь с местом и спланируйте культурную прогулку.'],
    [/культур/, 'культурное пространство. Основные сведения для планирования посещения.'],
    [/достопримеч|памят|историчес/, 'городская достопримечательность. Точка для знакомства с историей и прогулок.'],
    [/парк|прогул/, 'место для прогулок. Добавьте его в свой маршрут по городу.'],
    [/здоров|больниц|поликлиник/, 'медицинское учреждение. Основная информация для подготовки к посещению.'],
    [/красот|парикмах|маникюр/, 'услуги красоты и ухода. Адрес и режим работы помогут спланировать визит.'],
    [/спорт/, 'спортивный объект. Посмотрите местоположение и доступный график.'],
    [/транспорт/, 'транспортный объект. Основная информация для планирования поездки.'],
    [/инфраструктур/, 'объект городской инфраструктуры. Здесь указаны основные сведения о местоположении.'],
    [/жкх/, 'организация в сфере ЖКХ. Основные сведения о местоположении и режиме работы.'],
    [/ремонт/, 'ремонтные услуги. Основная информация для знакомства с исполнителем.'],
  ];
  const text = formats.find(([pattern]) => pattern.test(category))?.[1]
    ?? 'организация города. Здесь собраны основные сведения для посетителей.';
  return `${item.title} — ${text}`;
}

// Exact photo URLs are added only after an organization supplies the photo
// and its permission is reviewed. Hosting an old image ourselves is not proof.
const organizationPhotos: Readonly<Record<string, string>> = {};

export function basicPublicItem(item: Item): Item {
  if (item.kind === 'events') return item;
  return { ...item, phone: showsBasicPhone(item) ? item.phone : undefined,
    website: undefined, vkUrl: undefined, details: undefined,
    description: basicDescription(item), image: organizationPhotos[item.id] ?? '',
    photoIllustrative: false, photoCredit: undefined, photoSourceUrl: undefined, photoLicenseUrl: undefined };
}
