import {WinterSnow} from './WinterSnow';
import {useId} from 'react';
import {MediaImage} from '../components/MediaImage';
import {getCityCover} from '../data/cityCover';
import {useEventClock} from '../hooks/useEventClock';
import {winterTime} from './winterTime';
import './winter-scene.css';

type CityTime=ReturnType<typeof winterTime>;
const numerals=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
function ClockArt({time}:{time:CityTime}){
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <g>
  <defs>
   <radialGradient id={`${id}-face`} cx="32%" cy="25%"><stop stopColor={time.lampsOn?'#e5d8ac':'#d4ddcb'}/><stop offset="1" stopColor={time.lampsOn?'#a6a087':'#8da396'}/></radialGradient>
   <linearGradient id={`${id}-rim`} x2="1" y2="1"><stop stopColor="#65736b"/><stop offset=".45" stopColor="#192522"/><stop offset="1" stopColor="#070e13"/></linearGradient>
  </defs>
  {/* Clamps attach to the photographed foreground lamp at x=1550. */}
  <g className="city-clock-bracket" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
   <path d="M1501 361H1550M1465 416H1550M1474 417C1486 439 1505 433 1500 420M1503 417C1515 439 1534 432 1536 417"/>
   <path d="M1544 355H1557V368H1544M1544 409H1557V422H1544" strokeWidth="3"/>
  </g>
  <g className="city-clock-dial" transform="translate(1450 360) scale(.85)">
   <circle r="66" fill="#07141b"/>
   <circle r="62" fill={`url(#${id}-rim)`} stroke="#617165" strokeWidth="1.3"/>
   <circle r="57" fill={`url(#${id}-face)`} stroke="#a9b2a1" strokeWidth="1.5"/>
   <circle r="53" fill="none" stroke="#66776d" strokeWidth=".6"/>
   {Array.from({length:60},(_,i)=><line key={i} x1="0" y1={i%5===0?-51:-50} x2="0" y2={i%5===0?-47:-48} transform={`rotate(${i*6})`} stroke="#263d36" strokeWidth={i%5===0?1.2:.55}/>)}
   {numerals.map((n,i)=>{const angle=i*Math.PI/6;return <text key={n} x={Math.sin(angle)*40} y={-Math.cos(angle)*40} textAnchor="middle" dominantBaseline="central" fontFamily="Georgia,serif" fontSize="12" fill="#253e37">{n}</text>;})}
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
   <svg className="city-clock-world" viewBox="0 0 1606 979" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><ClockArt time={time}/></svg>
  </div>}
  <WinterSnow/>
 </div>;
}
