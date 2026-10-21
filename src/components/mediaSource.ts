import city from '../assets/city.svg';
import beauty from '../assets/beauty.svg';
import cinema from '../assets/cinema.svg';
import coffee from '../assets/coffee.svg';
import concert from '../assets/concert.svg';
import creative from '../assets/creative.svg';
import food from '../assets/food.svg';
import sport from '../assets/sport.svg';

const legacySources = new Set([city, beauty, cinema, coffee, concert, creative, food, sport]);

export function isLegacyIllustration(src: string) {
  return legacySources.has(src) || /\/(?:city|beauty|cinema|coffee|concert|creative|food|sport)(?:-[\w-]+)?\.svg(?:[?#]|$)/i.test(src);
}
