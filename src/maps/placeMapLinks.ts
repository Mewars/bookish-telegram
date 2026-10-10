import type { Item } from '../types';
type Coordinates = NonNullable<Item['coordinates']>;
export function validCoordinates(value: Item['coordinates']): value is Coordinates {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lon)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
}
function suppliedMapsUrl(value?: string): URL | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    const mainHost = url.hostname === 'yandex.ru' || url.hostname === 'yandex.com';
    if ((mainHost && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'))) || url.hostname === 'maps.yandex.ru') return url;
  } catch { /* Invalid external URLs are not rendered. */ }
}
function urlDestination(url?: URL): Coordinates | undefined {
  if (!url) return;
  // Only explicit markers/destinations, never viewport centers or guessed addresses.
  const marker = url.searchParams.get('pt')?.split('~')[0].split(',');
  const route = url.searchParams.get('rtext')?.split('~').pop()?.split(',');
  for (const [parts, reversed] of [[marker, true], [route, false]] as const) {
    if (!parts || parts.length < 2 || !parts.slice(0, 2).every(part => /^-?\d+(?:\.\d+)?$/.test(part))) continue;
    const point = reversed ? { lat: Number(parts[1]), lon: Number(parts[0]) } : { lat: Number(parts[0]), lon: Number(parts[1]) };
    if (validCoordinates(point)) return point;
  }
}
export function placeMapLinks(item: Partial<Pick<Item, 'coordinates' | 'yandexMapsUrl' | 'city' | 'address'>>) {
  const supplied = suppliedMapsUrl(item.yandexMapsUrl);
  const point = validCoordinates(item.coordinates) ? item.coordinates : undefined;
  const destination = point ?? urlDestination(supplied);
  let mapsUrl = supplied?.href;
  if (!mapsUrl && point) {
    const url = new URL('https://yandex.ru/maps/');
    url.searchParams.set('ll', `${point.lon},${point.lat}`);
    url.searchParams.set('pt', `${point.lon},${point.lat},pm2rdm`);
    url.searchParams.set('z', '16');
    mapsUrl = url.href;
  }
  // Address fallback uses only our own Item data, never a lookup or geocoder.
  const city = item.city?.trim();
  const address = item.address?.trim();
  const addressDestination = !supplied && !point && city && address ? `${city}, ${address}` : undefined;
  if (addressDestination) {
    const url = new URL('https://yandex.ru/maps/');
    url.searchParams.set('text', addressDestination);
    mapsUrl = url.href;
  }
  let routeUrl: string | undefined;
  if (destination) {
    const url = new URL('https://yandex.ru/maps/');
    url.searchParams.set('rtext', `~${destination.lat},${destination.lon}`);
    url.searchParams.set('rtt', 'auto');
    routeUrl = url.href;
  }
  // rtext accepts textual endpoints, but ~ separates waypoints after decoding.
  // Do not let an address containing that separator or control characters
  // create an unintended route. The search link remains available.
  if (addressDestination && !addressDestination.includes('~') && !/\p{Cc}/u.test(addressDestination)) {
    const url = new URL('https://yandex.ru/maps/');
    url.searchParams.set('rtext', `~${addressDestination}`);
    url.searchParams.set('rtt', 'auto');
    routeUrl = url.href;
  }
  return { mapsUrl, routeUrl };
}
