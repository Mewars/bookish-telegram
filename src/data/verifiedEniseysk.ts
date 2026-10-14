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
    description: 'Культурный центр Енисейска — пространство для творческой жизни города, занятий в студиях и участия в культурных программах. Здесь встречаются люди, интересующиеся искусством и местными инициативами; сведения о центре и контакты доступны в карточке.',
    address: 'ул. Ленина, 130', phone: '+7 (39195) 2-24-63',
    sourceUrl: 'https://www.culture.ru/institutes/103034/kulturnyi-centr-g-eniseiska',
  },
  {
    ...common, id: 'place-gdk-arutyunyan', kind: 'places',
    title: 'Городской дом культуры им. А. О. Арутюняна', category: 'Культура', image: creativeImage,
    description: 'Городской дом культуры имени А. О. Арутюняна — одна из площадок культурной жизни Енисейска. Здесь работают творческие коллективы и клубные объединения, а жители могут познакомиться с городской культурной программой и направлениями досуга.',
    address: 'ул. Ленина, 44', phone: '+7 (39195) 2-22-15',
    sourceUrl: 'https://www.culture.ru/institutes/73661/gorodskoi-dom-kultury-im-a-o-arutyunyana',
  },
  {
    ...common, id: 'place-central-library', kind: 'places',
    title: 'Центральная библиотека Енисейска', category: 'Библиотеки', image: creativeImage,
    description: 'Центральная библиотека Енисейска объединяет любовь к книгам и атмосферу исторического города: она размещается в доме купца Савельева. Сюда можно заглянуть за чтением, библиотечными услугами и знакомством с культурной жизнью Енисейска.',
    address: 'ул. Ленина, 95',
    sourceUrl: 'https://www.culture.ru/institutes/85017/centralnaya-biblioteka-g-eniseiska',
  },
  {
    ...common, id: 'place-childrens-library', kind: 'places',
    title: 'Городская детская библиотека', category: 'Библиотеки', image: creativeImage,
    description: 'Городская детская библиотека Енисейска — место, где дети знакомятся с книгами и находят новые истории. Книжный фонд, читальный зал и познавательные мероприятия делают библиотеку полезной точкой для семейного досуга и школьного чтения.',
    address: 'ул. Петровского, 7',
    sourceUrl: 'https://www.culture.ru/institutes/51329/gorodskaya-detskaya-biblioteka-eniseiska',
  },
  {
    ...common, id: 'place-library-branch-1', kind: 'places',
    title: 'Библиотека-филиал № 1', category: 'Библиотеки', image: creativeImage,
    description: 'Библиотека-филиал № 1 в Енисейске работает в здании молодёжного центра. Это место для чтения, общения и участия в культурных встречах: удобно заглянуть за книгой или узнать о библиотечных мероприятиях рядом с домом.',
    address: 'ул. Декабристов, 1',
    sourceUrl: 'https://www.culture.ru/institutes/55240/biblioteka-filial-1-g-eniseiska',
  },
  {
    ...common, id: 'place-hotel-eniseyskaya', kind: 'places',
    title: 'Гостиница «Енисейская»', category: 'Гостиницы', image: cityImage,
    description: 'Гостиница «Енисейская» — вариант размещения для гостей Енисейска, которые хотят остановиться ближе к городской инфраструктуре. На официальном сайте можно узнать о категориях номеров и условиях проживания перед поездкой.',
    address: 'ул. Ленина, 133', phone: '+7 (39195) 2-63-58',
    website: 'https://hotelenisei.ru/',
    sourceUrl: 'https://hotelenisei.ru/',
  },
  {
    ...common, id: 'place-hotel-domino', kind: 'places',
    title: 'Гостиница «Домино»', category: 'Гостиницы', image: cityImage,
    description: 'Гостиница «Домино» в Енисейске предлагает размещение для путешественников и гостей города. Перед бронированием стоит уточнить наличие номеров, стоимость и условия проживания; адрес гостиницы и ссылка на справочник указаны в карточке.',
    address: 'ул. Петровского, 2/1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001046023115',
  },
  {
    ...common, id: 'place-cafe-domino', kind: 'places',
    title: 'Кафе «Домино»', category: 'Кафе', image: foodImage,
    description: 'Кафе «Домино» — место в Енисейске, куда можно зайти на обед или перекус. В открытом справочнике представлены блюда повседневного меню; расположение и ссылка на страницу заведения помогут выбрать удобную остановку в городе.',
    address: 'ул. Петровского, 2/1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001066555159',
  },
  {
    ...common, id: 'place-myasorubka', kind: 'places',
    title: 'Бургерная «Мясорубка»', category: 'Кафе', image: foodImage,
    description: '«Мясорубка» — бургерная Енисейска с атмосферой стритфуда, где главное внимание уделено бургерам. В справочнике также отмечены картофель фри, закуски и доставка. Хороший вариант для сытного перекуса или встречи с друзьями; актуальное меню лучше уточнить перед заказом.',
    address: 'ул. Бабкина, 8',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001064232362',
  },
  {
    ...common, id: 'place-skazka', kind: 'places',
    title: 'Ресторан «Сказка»', category: 'Кафе', image: foodImage,
    description: '«Сказка» — ресторан русской кухни в Енисейске для тех, кто хочет пообедать или провести время за знакомыми домашними блюдами. В открытом меню упоминаются пельмени, супы и салаты; перед визитом можно проверить предложения и режим работы.',
    address: 'ул. Петровского, 11а',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%9F%D0%BE%D0%B5%D1%81%D1%82%D1%8C',
  },
  {
    ...common, id: 'place-veles', kind: 'places',
    title: 'Кафе «Велес»', category: 'Кафе', image: foodImage,
    description: '«Велес» — кафе Енисейска с выбором блюд для быстрого перекуса и полноценного обеда. В справочнике указаны шаурма, пицца, супы и другие позиции; уточнить меню и условия заказа удобно по источнику в карточке.',
    address: 'ул. Кирова, 87',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001053695069',
  },
  {
    ...common, id: 'place-sibirskiy-zames', kind: 'places',
    title: 'Кафе «Сибирский замес»', category: 'Кафе', image: foodImage,
    description: '«Сибирский замес» — кафе Енисейска с акцентом на домашнюю кухню. Здесь ищут знакомые вкусы: в справочнике упомянуты пельмени и драники, а также возможность взять кофе. Подойдёт для обеда и знакомства с местными гастрономическими точками.',
    address: 'ул. Худзинского, 1',
    sourceUrl: 'https://2gis.ru/enisejsk/firm/70000001088723956',
  },
  {
    ...common, id: 'place-sushisell', kind: 'places',
    title: 'СушиSell', category: 'Кафе', image: foodImage,
    description: 'СушиSell — служба доставки суши и роллов в Енисейске, представленная в городском справочнике. Подойдёт тем, кто выбирает блюда японской и азиатской кухни для заказа; актуальные позиции меню, адрес и условия доставки стоит проверить перед оформлением.',
    address: 'Партизанский пер., 3',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%A1%D1%83%D1%88%D0%B8',
  },
  {
    ...common, id: 'place-volna', kind: 'places',
    title: 'Столовая «Волна»', category: 'Кафе', image: foodImage,
    description: '«Волна» — столовая в Енисейске для тех, кто ищет простой и понятный формат обеда. Её адрес указан в туристическом буклете города; актуальное меню и часы обслуживания лучше уточнить непосредственно перед посещением.',
    address: 'ул. Бабкина, 4',
    sourceUrl: 'https://visitsiberia.info/assets/manager/Poleznoe/buklet/buklet-enisejsk.pdf',
  },
  {
    ...common, id: 'place-bulofnaya', kind: 'places',
    title: 'Пекарня «БулоФная»', category: 'Кафе', image: foodImage,
    description: '«БулоФная» — пекарня в Енисейске, которую стоит добавить в список мест для повседневных покупок выпечки. Загляните в карточку, чтобы найти адрес и перейти к справочнику; актуальный ассортимент и график работы лучше уточнить на месте.',
    address: 'ул. Ванеева, 1а',
    sourceUrl: 'https://2gis.ru/enisejsk/search/%D0%9F%D0%B5%D0%BA%D0%B0%D1%80%D0%BD%D1%8F',
  },
];

export const verifiedEniseyskServices: Item[] = [
  {
    ...common, id: 'service-mfc-eniseysk', kind: 'services',
    title: 'МФЦ «Мои документы»', category: 'Госуслуги', image: cityImage,
    description: 'МФЦ «Мои документы» в Енисейске помогает жителям обращаться за государственными и муниципальными услугами в одном месте. Адрес отделения, контактный телефон и ссылка на официальный сайт пригодятся, чтобы уточнить порядок обращения перед визитом.',
    address: 'ул. Ленина, 89', phone: '+7 (39195) 2-64-33',
    website: 'https://24mfc.ru/',
    sourceUrl: 'https://24mfc.ru/about/detail.php?ELEMENT_ID=439235',
    provider: 'СП КГБУ «МФЦ» в г. Енисейске',
  },
  {
    ...common, id: 'service-post-663180', kind: 'services',
    title: 'Почта России — отделение 663180', category: 'Почта', image: cityImage,
    description: 'Почтовое отделение № 663180 в Енисейске — точка обращения за услугами Почты России. В карточке собраны адрес и ссылка на официальный сайт, где можно проверить режим работы, доступные операции и информацию об отправлениях перед посещением.',
    address: 'ул. Ленина, 10',
    website: 'https://www.pochta.ru/offices/663180',
    sourceUrl: 'https://www.pochta.ru/offices/663180',
    provider: 'Почта России',
  },
];
