import {memo,useEffect,useId,useRef,useState} from 'react';
import {GARLAND_BULBS,GARLAND_SCENES,isGarlandCity} from './garlandLights';
import './winter-garlands.css';

const palette={
 amber:'#ffbf50',
 red:'#ff5660',
 mint:'#75ffad',
 blue:'#70ceff',
 pink:'#ff92e9',
} as const;

/** Lightweight SVG lights anchored exactly to the photographed tree crowns. */
export const WinterGarlands=memo(function WinterGarlands({city}:{city:string}){
 const visibleCity=isGarlandCity(city);
 const root=useRef<SVGSVGElement>(null);
 const [paused,setPaused]=useState(true);
 const prefix=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 useEffect(()=>{
  const node=root.current;
  if(!node||!visibleCity)return;
  let inView=false;
  const update=()=>setPaused(!inView||document.hidden);
  const observer=new IntersectionObserver(([entry])=>{
   inView=entry.isIntersecting;update();
  });
  observer.observe(node);
  document.addEventListener('visibilitychange',update);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);};
 },[city,visibleCity]);
 if(!visibleCity)return null;
 const scene=GARLAND_SCENES[city];
 return <svg ref={root} className="winter-garlands"
  data-city={city} data-paused={paused} viewBox={scene.viewBox}
  preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
  <defs>
   {Object.entries(palette).map(([name,color])=><radialGradient
    id={prefix+'-'+name} key={name}>
    <stop offset="0" stopColor="#fffbee" stopOpacity=".96"/>
    <stop offset=".15" stopColor={color} stopOpacity="1"/>
    <stop offset=".37" stopColor={color} stopOpacity=".62"/>
    <stop offset="1" stopColor={color} stopOpacity="0"/>
   </radialGradient>)}
  </defs>
  {GARLAND_BULBS[city].map((bulb,index)=><circle key={index}
   className={'winter-garland-bulb winter-garland-bulb--'+bulb.mode}
   cx={bulb.x} cy={bulb.y} r={bulb.r}
   fill={'url(#'+prefix+'-'+bulb.color+')'}
   style={{animationDuration:bulb.duration+'s',animationDelay:bulb.delay+'s'}}/>)}
 </svg>;
});
