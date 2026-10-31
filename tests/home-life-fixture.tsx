import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CityHome} from '../src/components/CityHome';
import type {Item} from '../src/types';
import '../src/styles.css';
const base={image:'/tests/photo-valid.png',description:'Проверка интерфейса на синтетических данных',address:'Тестовый адрес',real:true};
const items:Item[]=['Город А','Город Б','Енисейск'].flatMap(city=>[
 {...base,id:city+'-cafe',city,title:'Кофейня '+city,category:'Кафе',kind:'places'},
 {...base,id:city+'-park',city,title:'Парк '+city,category:'Парки',kind:'places'},
 {...base,id:city+'-museum',city,title:'Музей '+city,category:'Музеи',kind:'places'},
 {...base,id:city+'-event',city,title:'Событие '+city,category:'Выставка',kind:'events',dateOffset:1,time:'18:00',price:'Бесплатно'},
 {...base,id:city+'-past',city,title:'Прошедшее событие',category:'Выставка',kind:'events',dateOffset:-1},
]);
export function Fixture(){const[city,setCity]=useState('Город А');const[opened,setOpened]=useState('');return <><header className="app-header" style={{height:200,display:'flex'}}><label>Тестовый город<select aria-label="Тестовый город" value={city} onChange={e=>setCity(e.target.value)}><option>Город А</option><option>Город Б</option><option>Пустой город</option><option>Енисейск</option></select></label></header><CityHome city={city} cityProfile={{name:city,region:'Тестовая область',cover_url:'/tests/photo-valid.png'}} items={items} favorites={[]} toggle={()=>{}} open={item=>setOpened(item.title)} navigate={section=>setOpened(section)}/><output aria-label="Открытый раздел">{opened}</output></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
