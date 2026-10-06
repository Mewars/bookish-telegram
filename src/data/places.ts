import type { Item } from '../types';
import city from '../assets/city.svg';
import coffee from '../assets/coffee.svg';
import food from '../assets/food.svg';
import creative from '../assets/creative.svg';

// Only user-provided facts. Illustrations are placeholders, not photos of these places.
const suppliedMetadata = {
  kind: 'places' as const,
  city: 'Енисейск',
  real: true,
  verifiedAt: '2026-10-06',
  sourceType: 'user_provided',
};

export const places: Item[] = [
  {
    ...suppliedMetadata,
    id: 'place-kytmanov-museum',
    title: 'Енисейский историко-архитектурный музей-заповедник им. А.И. Кытманова',
    category: 'Музеи / Культура', image: city,
    address: 'ул. Ленина, 106', phone: '+7 991 438-83-80',
    description: 'Главный музейный комплекс Енисейска, посвящённый истории, архитектуре и культурному наследию города.',
    hours: '10:00–18:00, вторник–воскресенье',
  },
  {
    ...suppliedMetadata,
    id: 'place-borodkin-house',
    title: 'Гостевой дом купца Бородкина / Дом Бородкина',
    category: 'Музеи / История', image: city,
    address: 'ул. Рабоче-Крестьянская, 62',
    description: 'Купеческая усадьба XIX века с восстановленными историческими интерьерами. Здесь проводят экскурсии и программы о купеческом быте Енисейска.',
  },
  {
    ...suppliedMetadata,
    id: 'place-plane-museum',
    title: 'Музей рубанков', category: 'Музеи', image: city,
    address: 'ул. Пионерская, 5а', phone: '+7 908 220-54-75',
    description: 'Необычный частный музей Енисейска, посвящённый рубанкам и столярному ремеслу.',
    hours: '10:00–22:00',
  },
  {
    ...suppliedMetadata,
    id: 'place-photoizba',
    title: 'Музей-усадьба «Фотоизба»', category: 'Музеи / История', image: creative,
    address: 'ул. Ленина, 81', phone: '+7 950 426-18-21',
    description: 'Музей-усадьба в Енисейске, связанный с историей города и фотографией.',
    hours: '11:00–15:00',
  },
  {
    ...suppliedMetadata,
    id: 'place-spassky-monastery',
    title: 'Спасский Енисейский мужской монастырь', category: 'Достопримечательности', image: city,
    address: 'ул. Рабоче-Крестьянская, 103',
    description: 'Один из известных историко-архитектурных и религиозных объектов Енисейска.',
  },
  {
    ...suppliedMetadata,
    id: 'place-founders-monument',
    title: 'Памятник основателям города Енисейска', category: 'Достопримечательности', image: city,
    description: 'Памятник, посвящённый основателям Енисейска.',
    price: 'Бесплатно',
  },
  {
    ...suppliedMetadata,
    id: 'place-monastery-park',
    title: 'Монастырский парк', category: 'Парки / Прогулки', image: city,
    address: 'ул. Фефелова, 86',
    description: 'Городское пространство для прогулок рядом с исторической частью Енисейска.',
  },
  {
    ...suppliedMetadata,
    id: 'place-don-leon',
    title: 'Пиццерия Don Leon', category: 'Кафе', image: food,
    address: 'ул. Кирова, 81', phone: '+7 913 042-79-20',
    hours: '12:00–21:00', description: 'Пиццерия и кафе в Енисейске.',
  },
  {
    ...suppliedMetadata,
    id: 'place-blinnaya-izba',
    title: 'Блинная Изба', category: 'Кафе', image: coffee,
    address: 'ул. Рабоче-Крестьянская, 199', phone: '+7 983 363-30-07',
    hours: '10:00–20:00', description: 'Кафе в Енисейске.',
  },
  {
    ...suppliedMetadata,
    id: 'place-pritchi',
    title: 'Кафе «Притчи»', category: 'Кафе', image: coffee,
    address: 'ул. Бограда, 107', hours: '10:00–22:00',
    description: 'Кафе в Енисейске.',
  },
];
