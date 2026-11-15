/**
 * Coordinates are measured against the approved, immutable city artwork.
 * The image and this SVG both use right-aligned, vertically centered "cover".
 * All lights are deterministic: no frame-by-frame randomness or redraw.
 */
export type GarlandCity='Енисейск'|'Лесосибирск'|'Красноярск';
export type GarlandMode='soft'|'spark'|'wave';
export type GarlandColor='amber'|'red'|'mint'|'blue'|'pink';
export interface GarlandBulb {
 x:number;y:number;r:number;mode:GarlandMode;color:GarlandColor;
 duration:number;delay:number;
}
type GarlandBand=readonly [y:number,fromX:number,toX:number,count:number];
interface GarlandScene { viewBox:string; bands:readonly GarlandBand[];seed:number }
export const GARLAND_SCENES:Record<GarlandCity,GarlandScene>={
 'Енисейск':{
  viewBox:'0 0 1606 979',seed:127,
  bands:[[429,1490,1527,4],[474,1470,1550,8],[521,1444,1583,11],
   [567,1423,1593,12],[609,1408,1602,15],[656,1402,1602,16],
   [702,1395,1602,17],[740,1408,1594,15]],
 },
 'Лесосибирск':{
  viewBox:'0 0 1586 992',seed:277,
  bands:[[328,1546,1582,3],[375,1522,1584,5],[419,1505,1584,7],
   [461,1482,1584,9],[511,1461,1584,11],[558,1444,1584,12],
   [609,1431,1584,13],[650,1434,1584,13],[693,1420,1584,14]],
 },
 'Красноярск':{
  viewBox:'0 0 1586 992',seed:391,
  bands:[[540,1554,1582,3],[588,1533,1584,5],[635,1522,1584,7],
   [683,1508,1584,8],[729,1496,1584,10],[773,1489,1584,11],
   [815,1478,1584,11],[850,1469,1584,12]],
 },
};
const colors:GarlandColor[]=['amber','amber','amber','red','mint','blue','pink'];
const modes:GarlandMode[]=['soft','soft','soft','wave','spark'];
function random(seed:number):()=>number{
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
function createBulbs(scene:GarlandScene,city:GarlandCity):GarlandBulb[]{
 const rnd=random(scene.seed),result:GarlandBulb[]=[];
 for(const [y,left,right,count] of scene.bands){
  for(let i=0;i<count;i++){
   const x=left+(right-left)*(i+.35+rnd()*.3)/count;
   const yy=y+(rnd()-.5)*20;
   // A foreground lamp post in the Eniseysk artwork should remain unlit.
   if(city==='Енисейск'&&x>1543&&x<1567&&yy<700)continue;
   const mode=modes[Math.floor(rnd()*modes.length)];
   const duration=mode==='spark'?1.25+rnd()*1.75:mode==='wave'?3.4+rnd()*2.4:5.8+rnd()*7.3;
   const delay=-rnd()*duration;
   result.push({
    x:Number(x.toFixed(2)),y:Number(yy.toFixed(2)),r:Number((5.7+rnd()*3.3).toFixed(2)),
    mode,color:colors[Math.floor(rnd()*colors.length)],
    duration:Number(duration.toFixed(2)),delay:Number(delay.toFixed(2))
   });
  }
 }
 return result;
}
export const GARLAND_BULBS:Record<GarlandCity,GarlandBulb[]>={
 'Енисейск':createBulbs(GARLAND_SCENES['Енисейск'],'Енисейск'),
 'Лесосибирск':createBulbs(GARLAND_SCENES['Лесосибирск'],'Лесосибирск'),
 'Красноярск':createBulbs(GARLAND_SCENES['Красноярск'],'Красноярск'),
};
export function isGarlandCity(value:string):value is GarlandCity{
 return Object.prototype.hasOwnProperty.call(GARLAND_SCENES,value);
}
