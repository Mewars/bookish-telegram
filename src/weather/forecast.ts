import { parseMetNorwayForecast } from './metNorway';
import type { CityForecast } from './metNorway';

export const weatherCities: Record<string,string> = {'Енисейск':'eniseysk','Лесосибирск':'lesosibirsk'};
export type WeatherPoint = CityForecast & {rainMm:number|null;windMps:number|null};
export type Weather = {city:string;fetchedAt:string;stale:boolean;points:WeatherPoint[]};
const finite = (value:unknown,max:number):number|null => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max ? value : null;

export function readCityWeather(payload:unknown,city:string,now=Date.now()):Weather|null {
  if(!payload || typeof payload!=='object')return null;
  const data=payload as Record<string,unknown>;
  if(data.city!==city || typeof data.fetchedAt!=='string' || !Number.isFinite(Date.parse(data.fetchedAt)) ||
    now-Date.parse(data.fetchedAt)>6*3600000 || Date.parse(data.fetchedAt)>now+60000)return null;
  const forecast=data.forecast as {properties?:{timeseries?:unknown[]}}|undefined;
  if(!Array.isArray(forecast?.properties?.timeseries))return null;
  const points:WeatherPoint[]=[];
  for(const entry of forecast.properties.timeseries) {
    const parsed=parseMetNorwayForecast({properties:{timeseries:[entry]}});
    if(!parsed)continue;
    const time=Date.parse(parsed.validAt);
    if(time<now-3600000 || time>now+24*3600000)continue;
    const row=entry as {data?:{instant?:{details?:{wind_speed?:unknown}};next_1_hours?:{details?:{precipitation_amount?:unknown}}}};
    points.push({...parsed,rainMm:finite(row.data?.next_1_hours?.details?.precipitation_amount,500),windMps:finite(row.data?.instant?.details?.wind_speed,150)});
  }
  points.sort((a,b)=>Date.parse(a.validAt)-Date.parse(b.validAt));
  if(!points.length || Date.parse(points[0].validAt)>now+2*3600000)return null;
  return {city,fetchedAt:data.fetchedAt,stale:data.stale===true,points};
}

export function weatherDescription(symbol:string|null):string {
  const code=(symbol??'').replace(/_(day|night|polartwilight)$/,'');
  if(code.includes('thunder'))return 'Гроза';
  if(code.includes('sleet'))return 'Дождь со снегом';
  if(code.includes('snow'))return 'Снег';
  if(code.includes('rain'))return 'Дождь';
  return ({clearsky:'Ясно',fair:'Малооблачно',partlycloudy:'Переменная облачность',cloudy:'Облачно',fog:'Туман'} as Record<string,string>)[code]??'Прогноз погоды';
}
