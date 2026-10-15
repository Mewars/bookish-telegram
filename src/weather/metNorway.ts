/**
 * Pure MET Norway Locationforecast adapter.
 * No network access, credentials, browser geolocation or synthetic fallback values.
 * Forecasts are predictions, never observed measurements.
 */
export type CityForecast = {
  kind: 'forecast';
  validAt: string;
  temperatureC: number;
  symbolCode: string | null;
  provider: 'MET Norway';
  attributionUrl: 'https://api.met.no/';
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : null;
}

function utcTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().replace('.000Z', 'Z') === value
    ? value : null;
}

/**
 * Returns null for missing or malformed provider data. The UI must display an
 * unavailable state rather than inventing temperature, timestamp or icon.
 */
export function parseMetNorwayForecast(payload: unknown): CityForecast | null {
  const properties = record(record(payload)?.properties);
  const timeseries = properties?.timeseries;
  if (!Array.isArray(timeseries) || timeseries.length === 0) return null;

  const first = record(timeseries[0]);
  const validAt = utcTimestamp(first?.time);
  const data = record(first?.data);
  const instant = record(data?.instant);
  const details = record(instant?.details);
  const temperatureC = details?.air_temperature;
  if (!validAt || typeof temperatureC !== 'number' ||
    !Number.isFinite(temperatureC) || temperatureC < -100 || temperatureC > 70) return null;

  const nextHour = record(data?.next_1_hours);
  const summary = record(nextHour?.summary);
  const symbol = summary?.symbol_code;
  const symbolCode = typeof symbol === 'string' && /^[a-z0-9_]{1,80}$/.test(symbol)
    ? symbol : null;

  return {
    kind: 'forecast',
    validAt,
    temperatureC,
    symbolCode,
    provider: 'MET Norway',
    attributionUrl: 'https://api.met.no/',
  };
}
