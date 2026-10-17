import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { activePoint } from './repository';
import type { NearbyState } from './repository';

const centers:Record<string,[number,number]>={'Енисейск':[58.45,92.17],'Лесосибирск':[58.22,92.48]};
export function FriendsMap({city,data,now}:{city:string;data:NearbyState;now:number}) {
  const element=useRef<HTMLDivElement>(null);
  const map=useRef<L.Map|null>(null);
  const markers=useRef<L.LayerGroup|null>(null);
  const [tiles,setTiles]=useState(false);
  const [tileError,setTileError]=useState(false);
  const center=centers[city];
  useEffect(()=>{
    if(!element.current||!center)return;
    const instance=L.map(element.current,{scrollWheelZoom:false}).setView(center,13);
    map.current=instance;markers.current=L.layerGroup().addTo(instance);
    return ()=>{instance.remove();map.current=null;markers.current=null;};
  },[center]);
  useEffect(()=>{
    if(!map.current||!tiles)return;
    const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom:16,minZoom:4,
    }).addTo(map.current);
    layer.on('tileerror',()=>setTileError(true));
    return ()=>{layer.remove();};
  },[tiles,center]);
  useEffect(()=>{
    const group=markers.current;
    if(!group)return;
    group.clearLayers();
    const points=[...data.friends.filter(friend=>friend.accepted).map(friend=>({...friend,label:friend.name,self:false})),{...data.self,label:'Вы',self:true}];
    for(const point of points)if(activePoint(point,now)){
      const label=document.createElement('span');label.textContent=point.label+' · примерно';
      L.circleMarker([point.latitude!,point.longitude!],{radius:10,color:point.self?'#edbc61':'#92dbd0',fillColor:point.self?'#edbc61':'#92dbd0',fillOpacity:0.9,weight:3})
        .bindTooltip(label,{permanent:true,direction:'top',offset:[0,-10]}).addTo(group);
      L.circle([point.latitude!,point.longitude!],{radius:700,color:point.self?'#edbc61':'#92dbd0',weight:1,fillOpacity:0.08,interactive:false}).addTo(group);
    }
  },[data,now,center]);
  if(!center)return <p>Карта этого города пока не подключена. Друзья доступны в списке ниже.</p>;
  return <section className="friends-map-card" aria-label="Карта друзей">
    <div ref={element} className="friends-map" aria-label={`Карта города ${city}: приблизительные точки друзей`}/>
    <p>Точки приблизительные, с погрешностью около километра. Открытие карты не включает вашу геолокацию.</p>
    {!tiles&&<><button type="button" onClick={()=>{setTileError(false);setTiles(true);}}>Загрузить карту OpenStreetMap</button>
      <small>Подложка загрузится только по нажатию. OpenStreetMap получит ваш IP и запрошенную область карты. Имена и метки друзей ему не отправляются.</small></>}
    {tiles&&<button type="button" onClick={()=>setTiles(false)}>Отключить подложку карты</button>}
    {tiles&&tileError&&<p role="status">Не удалось загрузить часть карты. Приблизительные точки друзей остаются доступны; попробуйте подключить подложку позже.</p>}
  </section>;
}
