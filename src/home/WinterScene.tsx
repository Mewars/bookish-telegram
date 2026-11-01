import {useId} from 'react';
import {MediaImage} from '../components/MediaImage';
import {getCityCover} from '../data/cityCover';
import {useEventClock} from '../hooks/useEventClock';
import {winterTime} from './winterTime';
import './winter-scene.css';

type CityTime=ReturnType<typeof winterTime>;
const numerals=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
function ClockArt({time,stand=false}:{time:CityTime;stand?:boolean}){
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <g>
  <defs>
   <radialGradient id={`${id}-face`} cx="35%" cy="27%"><stop stopColor={time.lampsOn?'#fff8da':'#f1f2df'}/><stop offset="1" stopColor={time.lampsOn?'#e6d7a7':'#bcc8bc'}/></radialGradient>
   <linearGradient id={`${id}-rim`} x2="1" y2="1"><stop stopColor="#65736b"/><stop offset=".45" stopColor="#192522"/><stop offset="1" stopColor="#070e13"/></linearGradient>
  </defs>
  {stand&&<g className="city-clock-stand" fill="#142120" stroke="#07121a"><path d="M1541 215H1557V2200H1541Z"/><ellipse cx="1549" cy="216" rx="15" ry="8" fill="#e7edf0"/></g>}
  <g fill="none" stroke="#14211e" strokeWidth="7" strokeLinecap="round">
   <path d="M1451 325H1548M1462 325C1437 337 1465 351 1476 333C1483 320 1501 328 1496 339C1490 352 1514 345 1518 331C1522 318 1540 326 1548 325"/>
   <path d="M1512 261H1548"/>
  </g>
  <g transform="translate(1450 260)">
   <circle r="66" fill="#07141b"/>
   <circle r="62" fill={`url(#${id}-rim)`} stroke="#8b9276" strokeWidth="2"/>
   <circle r="57" fill={`url(#${id}-face)`} stroke="#a9b2a1" strokeWidth="1.5"/>
   <circle r="53" fill="none" stroke="#66776d" strokeWidth=".6"/>
   {Array.from({length:60},(_,i)=><line key={i} x1="0" y1={i%5===0?-51:-50} x2="0" y2={i%5===0?-47:-48} transform={`rotate(${i*6})`} stroke="#263d36" strokeWidth={i%5===0?1.2:.55}/>)}
   {numerals.map((n,i)=>{const angle=i*Math.PI/6;return <text key={n} x={Math.sin(angle)*40} y={-Math.cos(angle)*40} textAnchor="middle" dominantBaseline="central" fontFamily="Georgia,serif" fontSize="12" fill="#253e37" transform={`rotate(${i*30} ${Math.sin(angle)*40} ${-Math.cos(angle)*40})`}>{n}</text>;})}
   <path className="city-clock-hour" d="M-3 9L-4-25 0-34 4-25 3 9Z" fill="#142827" transform={`rotate(${time.hourAngle})`}/>
   <path className="city-clock-minute" d="M-2 12L-2-38 0-47 2-38 2 12Z" fill="#142827" transform={`rotate(${time.minuteAngle})`}/>
   <line className="city-clock-second" x1="0" y1="12" x2="0" y2="-49" stroke="#705247" strokeWidth=".8" transform={`rotate(${time.secondAngle})`}/>
   <circle r="4" fill="#263a32"/><circle r="1.5" fill="#c7b78c"/>
   <path d="M-43-50Q-16-70 20-61Q42-63 51-47Q32-54 15-53Q-13-59-43-50" fill="#eef2f4" stroke="#afbdc5" strokeWidth=".8"/>
  </g>
 </g>;
}
export function WinterScene({city,coverUrl}:{city:string;coverUrl?:string|null}){
 const now=useEventClock(city==='Енисейск'?1000:30000);
 const cover=getCityCover(city,coverUrl,now),time=winterTime(now);
 const winter=city==='Енисейск';
 return <div className={`cover-image${winter?' cover-image--winter':''}${cover?'':' cover-image--neutral'}`}>
  {cover&&<MediaImage src={cover.src} alt={cover.alt} eager/>}
  {winter&&<div className="city-clock" role="img" aria-label={`Городские часы: ${time.label.slice(0,5)}, время Енисейска`} data-time={time.label} data-lit={time.lampsOn}>
   <svg className="city-clock-world" viewBox="0 0 1606 979" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><ClockArt time={time} stand/></svg>
   <svg className="city-clock-mobile" viewBox="1355 180 251 799" preserveAspectRatio="xMaxYMin meet" aria-hidden="true"><ClockArt time={time} stand/></svg>
  </div>}
 </div>;
}
