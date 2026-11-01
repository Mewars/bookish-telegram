// One city timezone and one time sample drive both the hands and the lanterns.
export const WINTER_TIME_ZONE = 'Asia/Krasnoyarsk';
const formatter = new Intl.DateTimeFormat('en-GB', {timeZone:WINTER_TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function winterTime(now: Date) {
 const parts=formatter.formatToParts(now);
 const read=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
 const hour=read('hour'),minute=read('minute'),second=read('second');
 return {hour,minute,second,label:formatter.format(now),lampsOn:hour>=19||hour<9,
  hourAngle:(hour%12)*30+minute*.5+second/120,minuteAngle:minute*6+second*.1,secondAngle:second*6};
}
