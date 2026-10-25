import type { Item } from '../types';

// Owner-supplied public posters, 25 October 2026. Dates are fixed, never relative to a visit.
// No assumed duration: entries leave public lists after their final calendar day in the venue's zone.
const common={city:'Енисейск',kind:'events' as const,real:true,sourceType:'user_provided',verifiedAt:'2026-10-25',eventTimeZone:'Asia/Krasnoyarsk'};
const poster=(name:string)=>`${(import.meta.env?.BASE_URL??'/')}events/2026-10/${name}.webp`;
export const reviewedEvents:Item[]=[
 {...common,id:'event-eniseysk-rodina-20261023-28',title:'Кино в «Родине»',category:'Кино',image:poster('rodina-23-28'),eventStart:'2026-10-23',eventEnd:'2026-10-28',
  address:'Кинотеатр «Родина»',time:'11:00 · 13:00 · 15:10 · 17:10 · 19:20',price:'300–350 ₽',
  description:'23–28 октября: «Морозко», «Чудо-Юдо» и «Битва моторов». Пять сеансов ежедневно.',
  details:'Кинотеатр «Родина». Расписание на 23–28 октября 2026 года по присланной афише:\n11:00 — «Морозко», 300 ₽.\n13:00 — «Чудо-Юдо», 300 ₽.\n15:10 — «Морозко», 350 ₽.\n17:10 — «Чудо-Юдо», 350 ₽.\n19:20 — «Битва моторов», 350 ₽.\nПеред посещением уточняйте изменения расписания и наличие билетов у кинотеатра.'},
 {...common,id:'event-eniseysk-gore-ot-uma-20261026',title:'Спектакль «Горе от ума»',category:'Театр',image:poster('gore-ot-uma'),eventStart:'2026-10-26',time:'15:00',address:'ул. Ленина, 130',price:'250 ₽',label:'12+',
  website:'https://quicktickets.ru/motygino-dramteatr/s823',sourceUrl:'https://quicktickets.ru/motygino-dramteatr/s823',
  description:'12+ · Спектакль Мотыгинского драматического театра в Культурном центре. Действует Пушкинская карта.',
  details:'12+. Спектакль «Горе от ума» в Культурном центре Енисейска. Начало 26 октября в 15:00. Билет — 250 ₽. Действует Пушкинская карта. Билеты в кассе Культурного центра — только наличный расчёт; онлайн — по ссылке покупки билетов.'},
 {...common,id:'event-eniseysk-pust-dusha-20261028',title:'«Пусть душа останется чиста»',category:'Мероприятия',image:poster('pust-dusha'),eventStart:'2026-10-28',time:'16:00',address:'ул. Ленина, 44',price:'300 ₽',label:'6+',website:'https://qsgo.ru/MtBoic',
  description:'6+ · Литературно-музыкальная композиция в Городском доме культуры. Действует Пушкинская карта.',
  details:'6+. Литературно-музыкальная композиция «Пусть душа останется чиста». 28 октября, 16:00, Городской дом культуры. Билет — 300 ₽. Действует Пушкинская карта. Онлайн-билеты — по ссылке организатора.'},
 {...common,id:'event-eniseysk-zelenaya-lampa-20261031',title:'Концерт «Зелёная лампа»',category:'Концерты',image:poster('zelenaya-lampa'),eventStart:'2026-10-31',time:'15:00',address:'ул. Ленина, 130',price:'100 ₽',label:'12+',website:'https://qsgo.ru/KAvLed',
  description:'12+ · Ансамбль авторской песни. «Наполним музыкой сердца» — по классике бардовской песни.',
  details:'12+. Концерт ансамбля авторской песни «Зелёная лампа» в Культурном центре. 31 октября, 15:00. Билет — 100 ₽. Билеты в кассе — только наличный расчёт; онлайн — по ссылке организатора.'},
 {...common,id:'event-eniseysk-dayte-slovo-20261115',title:'«Дайте слово молодым»',category:'Мероприятия',image:poster('dayte-slovo'),eventStart:'2026-11-15',time:'15:00',address:'ул. Ленина, 130',
  description:'Подведение итогов открытого межрегионального литературного конкурса-фестиваля имени Николая Эрдмана.',
  details:'15 ноября, 15:00, Культурный центр. Литературный конкурс-фестиваль имени Николая Эрдмана «Дайте слово молодым». По присланной афише: поэзия и малая проза, участники 14–35 лет. Стоимость посещения и условия участия в афише не указаны — уточняйте у организатора.'},
];
