import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMetNorwayForecast } from '../src/weather/metNorway.ts';

function forecast(temperature = -12.5, time = '2026-10-16T03:00:00Z', symbol = 'cloudy') {
  return {
    properties: {
      timeseries: [{
        time,
        data: {
          instant: { details: { air_temperature: temperature } },
          next_1_hours: { summary: { symbol_code: symbol } },
        },
      }],
    },
  };
}

test('parses the first provider forecast without implying an observation', () => {
  assert.deepEqual(parseMetNorwayForecast(forecast()), {
    kind: 'forecast',
    validAt: '2026-10-16T03:00:00Z',
    temperatureC: -12.5,
    symbolCode: 'cloudy',
    provider: 'MET Norway',
    attributionUrl: 'https://api.met.no/',
  });
});

test('allows zero degrees and a forecast without a valid icon', () => {
  const payload = forecast(0);
  payload.properties.timeseries[0].data.next_1_hours.summary.symbol_code = 'INVALID <svg>';
  assert.deepEqual(parseMetNorwayForecast(payload), {
    kind: 'forecast',
    validAt: '2026-10-16T03:00:00Z',
    temperatureC: 0,
    symbolCode: null,
    provider: 'MET Norway',
    attributionUrl: 'https://api.met.no/',
  });
});

test('rejects missing, malformed, or non-numeric temperatures rather than inventing weather', () => {
  for (const payload of [
    null, undefined, {}, [], { properties: {} }, { properties: { timeseries: [] } },
    forecast('12'), forecast(NaN), forecast(Infinity), forecast(-101), forecast(71),
  ]) assert.equal(parseMetNorwayForecast(payload), null);
});

test('rejects invalid or noncanonical timestamps', () => {
  for (const time of [
    '2026-02-30T00:00:00Z', '2026-10-16T03:00:00+00:00',
    '2026-10-16T03:00:00.000Z', 'not-a-time', '',
  ]) assert.equal(parseMetNorwayForecast(forecast(10, time)), null);
});

test('never requires the optional next-hour summary', () => {
  const payload = forecast(5);
  delete payload.properties.timeseries[0].data.next_1_hours;
  assert.equal(parseMetNorwayForecast(payload)?.symbolCode, null);
});
