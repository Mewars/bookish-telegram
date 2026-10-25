import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CityHome} from '../src/components/CityHome';
import {CatalogPage} from '../src/pages/CatalogPage';
import {DetailPage} from '../src/pages/DetailPage';
import {reviewedEvents} from '../src/data/events';
import {emptyCatalogFilters} from '../src/navigation/catalogRoute';
import type {Item} from '../src/types';
import '../src/styles.css';
const items:Item[]=[...reviewedEvents,{id:'test-cafe',city:'Енисейск',kind:'places',title:'Работающее кафе',category:'Кафе',description:'Тест',image:'',hours:'ежедневно 10:00–20:00'}];
export function Fixture(){
 const[city,setCity]=useState('Енисейск');const[mode,setMode]=useState('home');const[item,setItem]=useState<Item>();const[filters,setFilters]=useState(emptyCatalogFilters);
 const actions={favorites:[],toggle:()=>{},open:(entry:Item)=>{setItem(entry);setMode('detail');}};
 return <><header><label>Тестовый город<select aria-label="Тестовый город" value={city} onChange={e=>{setCity(e.target.value);setMode('home');}}><option>Енисейск</option><option>Лесосибирск</option></select></label><button onClick={()=>setMode('home')}>На главную</button><button onClick={()=>setMode('events')}>Открыть афишу</button></header>{mode==='home'?<CityHome key={city} {...actions} city={city} items={items} navigate={()=>setMode('events')}/>:mode==='detail'&&item?<DetailPage {...actions} saved={false} item={item} goBack={()=>setMode('events')}/>:<CatalogPage {...actions} kind="events" city={city} items={items} filters={filters} onFiltersChange={setFilters}/>}</>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
