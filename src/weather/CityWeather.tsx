import { useEffect, useId, useRef, useState } from 'react';
import { readCityWeather, weatherCities, weatherDescription } from './forecast';
import type { Weather } from './forecast';
import { WeatherIcon } from './WeatherIcon';
import './weather.css';

const timeLabel=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Asia/Krasnoyarsk',hour:'2-digit',minute:'2-digit'});
const temperature=(value:number)=>(value>0?'+':'')+Math.round(value)+'°';
export function CityWeather({city}:{city:string}) {
  const [state,setState]=useState<{city:string;data:Weather|null;loading:boolean}>({city,data:null,loading:true});
  const [retry,setRetry]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  const dialogId=useId();
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible')setRetry(value=>value+1);};
    const interval=window.setInterval(refresh,15*60*1000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    const timeout=window.setTimeout(()=>controller.abort(),12000);
    if(weatherCities[city])void fetch(`${import.meta.env.BASE_URL}api/weather.php?city=${weatherCities[city]}`,{signal:controller.signal,credentials:'omit'})
      .then(response=>{if(!response.ok)throw Error('unavailable');return response.json();})
      .then(payload=>{if(active)setState({city,data:readCityWeather(payload,city),loading:false});})
      .catch(()=>{if(active)setState({city,data:null,loading:false});});
    return ()=>{active=false;controller.abort();window.clearTimeout(timeout);};
  },[city,retry]);
  const weather=state.city===city?state.data:null;
  const loading=weatherCities[city] && (state.city!==city || state.loading);
  const current=weather?.points[0];
  return <>
    <button type="button" className="city-weather-trigger" aria-label={`Погода в ${city}${current?': '+weatherDescription(current.symbolCode):''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
      onClick={()=>{dialog.current?.showModal();setOpen(true);}}><WeatherIcon symbol={current?.symbolCode}/></button>
    <dialog ref={dialog} id={dialogId} className="weather-dialog" aria-label={`Погода — ${city}`} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
    <section className="city-weather">
    <div className="weather-heading"><div><span className="section-index">ПОГОДА СЕГОДНЯ</span><h2>{city}</h2></div>
      <button type="button" className="weather-close" aria-label="Закрыть погоду" onClick={()=>dialog.current?.close()}>×</button></div>
    {loading?<p role="status">Загружаем прогноз…</p>:current&&weather?<>
      <div className="weather-current"><strong>{temperature(current.temperatureC)}</strong><div><p>{weatherDescription(current.symbolCode)}</p><small>Прогноз на {timeLabel(current.validAt)}</small></div></div>
      <p className="weather-details">{current.rainMm===null?'Осадки: нет данных':`Осадки за час: ${current.rainMm.toLocaleString('ru-RU')} мм`}
        {current.windMps!==null&&` · Ветер ${current.windMps.toLocaleString('ru-RU')} м/с`}</p>
      <h3 className="weather-hours-title">По часам <small>Ближайшие сутки · листайте</small></h3><ol className="weather-hours">
        {weather.points.map(point=><li key={point.validAt}>
          <time dateTime={point.validAt}>{timeLabel(point.validAt)}</time><strong>{temperature(point.temperatureC)}</strong>
          <WeatherIcon symbol={point.symbolCode} size={22}/>
          <span>{weatherDescription(point.symbolCode)}</span><small>{point.rainMm===null?'Осадки —':`${point.rainMm.toLocaleString('ru-RU')} мм/ч`}</small>
        </li>)}
      </ol>
      <p className="weather-source">{weather.stale?'Свежий прогноз недоступен. Последнее обновление':'Обновлено'} {timeLabel(weather.fetchedAt)} · <a href="https://api.met.no/" target="_blank" rel="noreferrer">MET Norway</a></p>
    </>:<div className="weather-unavailable"><p>{weatherCities[city]?'Прогноз временно недоступен. Попробуйте немного позже.':'Прогноз для этого города пока не подключён.'}</p>
      {weatherCities[city]&&<button type="button" onClick={()=>{setState({city,data:null,loading:true});setRetry(value=>value+1);}}>Обновить прогноз</button>}</div>}
  </section></dialog></>;
}
