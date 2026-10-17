import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readCityWeather,weatherDescription} from '../src/weather/forecast.ts';

const now=Date.parse('2026-10-17T06:30:00Z');
const point=(time,temp=3)=>({time,data:{instant:{details:{air_temperature:temp,wind_speed:2}},next_1_hours:{summary:{symbol_code:'rain'},details:{precipitation_amount:0.4}}}});
const response=()=>({city:'Енисейск',fetchedAt:'2026-10-17T06:25:00Z',forecast:{properties:{timeseries:[point('2026-10-17T06:00:00Z'),point('2026-10-17T09:00:00Z',5)]}}});
test('weather chooses a recent forecast, preserves zero/unknown rainfall and discards past data',()=>{
  const data=response();
  data.forecast.properties.timeseries.unshift(point('2026-10-17T03:00:00Z',-8));
  data.forecast.properties.timeseries[1].data.next_1_hours.details.precipitation_amount=0;
  delete data.forecast.properties.timeseries[2].data.next_1_hours;
  const weather=readCityWeather(data,'Енисейск',now);
  assert.equal(weather.points.length,2);
  assert.equal(weather.points[0].temperatureC,3);
  assert.equal(weather.points[0].rainMm,0);
  assert.equal(weather.points[1].rainMm,null);
});
test('wrong city, old/future fetch time, malformed data and forecasts starting tomorrow are unavailable',()=>{
  assert.equal(readCityWeather(response(),'Лесосибирск',now),null);
  for(const value of [null,{},'bad',{...response(),fetchedAt:'bad'},{...response(),fetchedAt:'2026-10-16T01:00:00Z'},{...response(),fetchedAt:'2026-10-18T01:00:00Z'}])
    assert.equal(readCityWeather(value,'Енисейск',now),null);
  const later=response();later.forecast.properties.timeseries=[point('2026-10-17T12:00:00Z')];
  assert.equal(readCityWeather(later,'Енисейск',now),null);
});
test('invalid measurements never become invented temperature/rain/wind',()=>{
  const data=response();
  data.forecast.properties.timeseries[0]=point('2026-10-17T06:00:00Z',Infinity);
  assert.equal(readCityWeather(data,'Енисейск',now),null);
  const another=response();
  another.forecast.properties.timeseries[0].data.instant.details.wind_speed=-5;
  another.forecast.properties.timeseries[0].data.next_1_hours.details.precipitation_amount=NaN;
  const parsed=readCityWeather(another,'Енисейск',now);
  assert.equal(parsed.points[0].rainMm,null);assert.equal(parsed.points[0].windMps,null);
});
test('weather descriptions are human-readable and preserve unsupported symbol uncertainty',()=>{
  assert.equal(weatherDescription('heavysnowshowers_night'),'Снег');
  assert.equal(weatherDescription('rainandthunder'),'Гроза');
  assert.equal(weatherDescription('clearsky_day'),'Ясно');
  assert.equal(weatherDescription('unknown'),'Прогноз погоды');
});
