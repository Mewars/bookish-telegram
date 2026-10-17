import { weatherIconKind } from './forecast';

export function WeatherIcon({symbol,size=26}:{symbol:string|null|undefined;size?:number}) {
  const kind=weatherIconKind(symbol);
  const cloud=['cloud','partly','rain','snow','sleet','thunder','fog'].includes(kind);
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-weather-icon={kind}>
    {(kind==='sun'||kind==='partly')&&<g stroke="#f2c46d"><circle cx={kind==='partly'?11:16} cy={kind==='partly'?10:16} r="5" fill="#f2c46d"/>
      {kind==='sun'?<path d="M16 3v3m0 20v3M3 16h3m20 0h3M7 7l2 2m14 14 2 2M7 25l2-2M23 9l2-2"/>:<path d="M11 1v2M2 10h2m.5-6.5L6 5M17 4l1-1"/>}</g>}
    {kind==='moon'&&<path d="M24 21A11 11 0 0 1 11 5a11 11 0 1 0 13 16Z" fill="#e6edf1" stroke="#e6edf1"/>}
    {cloud&&<path d="M8 22a5 5 0 0 1-.7-10A8 8 0 0 1 22.5 11 5.5 5.5 0 1 1 25 22Z" fill="#e3edf2" stroke="#e3edf2"/>}
    {(kind==='rain'||kind==='sleet')&&<g stroke="#91cef0"><path d="m9 25-1 3m9-3-1 3"/>{kind==='rain'&&<path d="m25 25-1 3"/>}</g>}
    {(kind==='snow'||kind==='sleet')&&<g stroke="#bce7f5"><path d="M24 25v5m-2-4 4 3m-4 0 4-3"/>{kind==='snow'&&<><path d="M9 25v5m-2-4 4 3m-4 0 4-3"/><circle cx="16" cy="26" r=".6"/></>}</g>}
    {kind==='thunder'&&<path d="m18 21-4 6h4l-2 4 7-7h-4l2-3" fill="#f2c46d" stroke="#f2c46d"/>}
    {kind==='fog'&&<path d="M7 26h18M11 30h11" stroke="#b9cbd5"/>}
    {kind==='unknown'&&<g stroke="#c4d2dc"><circle cx="16" cy="16" r="11"/><path d="M13 12a3 3 0 0 1 6 0c0 3-3 2-3 5m0 5h.01"/></g>}
  </svg>;
}
