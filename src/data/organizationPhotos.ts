import type { Item } from '../types';

// Licensed photo references for 25 vetted cards. Keep the image label honest:
// generic Unsplash images illustrate a *type* of business and are never claimed
// to be the exterior/interior/food of the specific Eniseysk establishment.
// Copyright/source credit is visible in the detail view; licensed photos may
// load from remote CDN and the MediaImage component has a local SVG fallback.
// Details in docs/organization-photo-credits.md.
const licensedImages: Record<string, Pick<Item, 'image' | 'photoIllustrative' | 'photoCredit' | 'photoSourceUrl' | 'photoLicenseUrl'>> = {
  'place-kytmanov-museum': {
    image: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-borodkin-house': {
    image: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-plane-museum': {
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-photoizba': {
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-founders-monument': {
    image: 'https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-monastery-park': {
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-don-leon': {
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-culture-center-eniseysk': {
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-gdk-arutyunyan': {
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-childrens-library': {
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-library-branch-1': {
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-hotel-eniseyskaya': {
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-hotel-domino': {
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-cafe-domino': {
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-myasorubka': {
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-skazka': {
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-veles': {
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-sibirskiy-zames': {
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-sushisell': {
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-volna': {
    image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-bulofnaya': {
    image: 'https://images.unsplash.com/photo-1608198093002-ad4e005484df?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'service-mfc-eniseysk': {
    image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'service-post-663180': {
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=1100&q=78',
    photoIllustrative: true,
    photoCredit: 'Тематическое фото — Unsplash',
    photoSourceUrl: 'https://unsplash.com/license',
  },
  'place-central-library': {
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/%D0%94%D0%BE%D0%BC_%D0%BA%D1%83%D0%BF%D1%86%D0%B0_%D0%A1%D0%B0%D0%B2%D0%B5%D0%BB%D1%8C%D0%B5%D0%B2%D0%B0%2C_%D1%84%D0%BE%D1%82%D0%BE_2017_%D0%B3.jpg/1280px-%D0%94%D0%BE%D0%BC_%D0%BA%D1%83%D0%BF%D1%86%D0%B0_%D0%A1%D0%B0%D0%B2%D0%B5%D0%BB%D1%8C%D0%B5%D0%B2%D0%B0%2C_%D1%84%D0%BE%D1%82%D0%BE_2017_%D0%B3.jpg',
    photoIllustrative: false,
    photoCredit: 'Фото: Юлия Анатольевна Маркова, Wikimedia Commons (CC BY-SA 4.0)',
    photoSourceUrl: 'https://commons.wikimedia.org/wiki/File:%D0%94%D0%BE%D0%BC_%D0%BA%D1%83%D0%BF%D1%86%D0%B0_%D0%A1%D0%B0%D0%B2%D0%B5%D0%BB%D1%8C%D0%B5%D0%B2%D0%B0,_%D1%84%D0%BE%D1%82%D0%BE_2017_%D0%B3.jpg',
    photoLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
};

export function withDirectoryPhoto(item: Item): Item {
  // A separately verified photo of Spassky monastery already belongs to the
  // site's local public assets. Never overwrite a real photo with stock.
  const photo = licensedImages[item.id];
  return photo ? { ...item, ...photo } : item;
}

export const assignedDirectoryPhotoIds = Object.keys(licensedImages);
