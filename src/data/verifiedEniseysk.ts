import type { Item } from '../types';
import cityImage from '../assets/city.svg';
import foodImage from '../assets/food.svg';
import creativeImage from '../assets/creative.svg';

// Factual directory entries compiled from public official pages and 2GIS.
// Details verified online on 2026-10-14; not in-person audit or owner claim.
// No third-party images, invented events, estimates of ratings, or guessed hours.
const common = { city: 'Енисейск', real: true, verifiedAt: '2026-10-14', sourceType: 'manual_verified' } as const;

export const verifiedEniseyskPlaces: Item[] = [
  {
    ...common, id: 'place-culture-center-eniseysk', kind: 'places',
    title: 'Культурный центр г. Енисейска', category: 'Культура', image: creativeImage,
    description: 'Культурное учреждение на улице Ленина с творческими студиями и программами для жителей города.',
    address: 'ул. Ленина, 130', phone: '+7 (39195) 2-24-63',
    sourceUrl: 'https://www.culture.ru/institutes/103034/kulturnyi-centr-g-eniseiska',
  },
  {
    ...common, id: 'place-gdk-arutyunyan', kind: 'places',
    title: 'Городской дом культуры им. А. О. Арутюняна', category: 'Культура', image: creativeImage,
    description: 'Городской дом культуры, в котором действуют творческие коллективы и клубные объединения.',
    address: 'ул. Ленина, 44', phone: '+7 (39195) 2-22-15',
    sourceUrl: 'https://www.culture.ru/institutes/73661/gorodskoi-dom-kultury-im-a-o-arutyunyana',
  },
  {
    ...common, id: 'place-central-library', kind: 'places',
    title: 'Центральная библиотека Енисейска', category: 'Библиотеки', image: creativeImage,
    description: 'Городская библиотека, размещённая в историческом доме купца Савельева.',
    address: 'ул. Ленина, 95',
    sourceUrl: 'https://www.culture.ru/institutes/85017/centralnaya-biblioteka-g-eniseiska',
  },
  {
    ...common, id: 'place-childrens-library', kind: 'places',
    title: 'Городская детская библиотека', category: 'Библиотеки', image: creativeImage,
    description: 'Библиотека для детей с книжным фондом, читальным залом и познавательными мероприятиями.',
    address: 'ул. Петровского, 7',
    sourceUrl: 'https://www.culture.ru/institutes/51329/gorodskaya-detskaya-biblioteka-eniseiska',
  },
  {
    ...common, id: 'place-library-branch-1', kind: 'places',
    title: 'Библиотека-филиал № 1', category: 'Библиотеки', image: creativeImage,
    description: 'Районная библиотека в здании молодёжного центра; здесь проводят встречи и культурные программы.',
    address: 'ул. Декабристов, 1',
    sourceUrl: 'https://www.culture.ru/institutes/55240/biblioteka-filial-1-g-eniseiska',
  },
  {
    ...common, id: 'place-hotel-eniseyskaya', kind: 'places',
    title: 'Гостиница «Енисейская»', category: 'Гостиницы', image: cityImage,
    description: 'Гостиница в центре Енисейска с номерами разных категорий и собственной территорией.',
    address: 'ул. Ленина, 133', phone: '+7 (39195) 2-63-58',
    website: 'https://hotelenisei.ru/',
    sourceUrl: 'https://hotelenisei.ru/',
  },
  {
    ...common, id: 'place-hotel-domino', kind: 'places',
    title: 'Гостиница «Домино»', category: 'Гостиницы', image: cityImage,
    description: 'Гостиница на улице Петровского; условия проживания и стоимость лучше уточнить перед поездкой.',
    address: 'ул. Петровского, 2/1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001046023115',
  },
  {
    ...common, id: 'place-cafe-domino', kind: 'places',
    title: 'Кафе «Домино»', category: 'Кафе', image: foodImage,
    description: 'Кафе в Енисейске, где представлены горячие блюда и обеды.',
    address: 'ул. Петровского, 2/1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001066555159',
  },
  {
    ...common, id: 'place-myasorubka', kind: 'places',
    title: 'Бургерная «Мясорубка»', category: 'Кафе', image: foodImage,
    description: 'Бургерная на улице Бабкина с блюдами быстрого питания.',
    address: 'ул. Бабкина, 8',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001064232362',
  },
  {
    ...common, id: 'place-skazka', kind: 'places',
    title: 'Ресторан «Сказка»', category: 'Кафе', image: foodImage,
    description: 'Ресторан русской кухни; в открытом справочнике указаны пельмени, салаты и горячие блюда.',
    address: 'ул. Петровского, 11а',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%9F%D0%BE%D0%B5%D1%81%D1%82%D1%8C',
  },
  {
    ...common, id: 'place-veles', kind: 'places',
    title: 'Кафе «Велес»', category: 'Кафе', image: foodImage,
    description: 'Кафе на улице Кирова; в открытом справочнике указаны шаурма, пицца и горячие блюда.',
    address: 'ул. Кирова, 87',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001053695069',
  },
  {
    ...common, id: 'place-sibirskiy-zames', kind: 'places',
    title: 'Кафе «Сибирский замес»', category: 'Кафе', image: foodImage,
    description: 'Кафе с домашней кухней; среди представленных блюд — пельмени и драники.',
    address: 'ул. Худзинского, 1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001088723956',
  },
  {
    ...common, id: 'place-sushisell', kind: 'places',
    title: 'СушиSell', category: 'Кафе', image: foodImage,
    description: 'Заведение и служба доставки суши и роллов в Енисейске.',
    address: 'Партизанский пер., 3',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%A1%D1%83%D1%88%D0%B8',
  },
  {
    ...common, id: 'place-volna', kind: 'places',
    title: 'Столовая «Волна»', category: 'Кафе', image: foodImage,
    description: 'Столовая на улице Бабкина с горячими обедами.',
    address: 'ул. Бабкина, 4',
    sourceUrl: 'https://visitsiberia.info/assets/manager/Poleznoe/buklet/buklet-enisejsk.pdf',
  },
  {
    ...common, id: 'place-bulofnaya', kind: 'places',
    title: 'Пекарня «БулоФная»', category: 'Кафе', image: foodImage,
    description: 'Пекарня на улице Ванеева в Енисейске.',
    address: 'ул. Ванеева, 1а',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%9F%D0%B5%D0%BA%D0%B0%D1%80%D0%BD%D1%8F',
  },
];

export const verifiedEniseyskServices: Item[] = [
  {
    ...common, id: 'service-mfc-eniseysk', kind: 'services',
    title: 'МФЦ «Мои документы»', category: 'Госуслуги', image: cityImage,
    description: 'Центр предоставления государственных и муниципальных услуг в Енисейске.',
    address: 'ул. Ленина, 89', phone: '+7 (39195) 2-64-33',
    website: 'https://24mfc.ru/',
    sourceUrl: 'https://24mfc.ru/about/detail.php?ELEMENT_ID=439235',
    provider: 'СП КГБУ «МФЦ» в г. Енисейске',
  },
  {
    ...common, id: 'service-post-663180', kind: 'services',
    title: 'Почта России — отделение 663180', category: 'Почта', image: cityImage,
    description: 'Почтовое отделение в центре Енисейска; актуальные часы работы и услуги уточняйте на сайте Почты России.',
    address: 'ул. Ленина, 10',
    website: 'https://www.pochta.ru/offices/663180',
    sourceUrl: 'https://www.pochta.ru/offices/663180',
    provider: 'Почта России',
  },
];
