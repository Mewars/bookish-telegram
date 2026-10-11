import type { Item } from '../types';
import { validCoordinates } from './placeMapLinks';

// Use only coordinates already supplied with the place. Do not guess or
// geocode addresses with a third-party service.
const MAX_OSM_LATITUDE = 85.05112878;
const LAT_RADIUS = 0.006;
const LON_RADIUS = 0.012;

type Coordinates = Item['coordinates'];

export function openStreetMapUrls(point: Coordinates): { embedUrl: string; pageUrl: string } | undefined {
  if (!validCoordinates(point) || Math.abs(point.lat) > MAX_OSM_LATITUDE) return undefined;

  const west = Math.max(-180, point.lon - LON_RADIUS);
  const east = Math.min(180, point.lon + LON_RADIUS);
  const south = Math.max(-MAX_OSM_LATITUDE, point.lat - LAT_RADIUS);
  const north = Math.min(MAX_OSM_LATITUDE, point.lat + LAT_RADIUS);

  const embed = new URL('https://www.openstreetmap.org/export/embed.html');
  embed.searchParams.set('bbox', [west, south, east, north].join(','));
  embed.searchParams.set('layer', 'mapnik');
  embed.searchParams.set('marker', [point.lat, point.lon].join(','));

  const page = new URL('https://www.openstreetmap.org/');
  page.searchParams.set('mlat', String(point.lat));
  page.searchParams.set('mlon', String(point.lon));
  page.hash = 'map=16/' + point.lat + '/' + point.lon;

  return { embedUrl: embed.href, pageUrl: page.href };
}
