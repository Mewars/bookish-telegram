import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CatalogPage} from '../src/pages/CatalogPage';
import {DetailPage} from '../src/pages/DetailPage';
import {Card} from '../src/components/Card';
import {emptyCatalogFilters} from '../src/navigation/catalogRoute';
import type {Item} from '../src/types';
import '../src/styles.css';
const base={city:'Тестовый город',kind:'services' as const,image:'',real:true,address:'Тестовая улица, 1',phone:'+7 (000) 000-00-00',hours:'пн-пт 10:00–18:00',description:'Скрытое расширенное описание',website:'https://example.org/business-website',vkUrl:'https://vk.com/example-business',coordinates:{lat:58,lon:92},sourceUrl:'https://example.org/internal-source'};
const rows:Item[]=[['Лицо','Красота / Косметологи'],['Волосы','Красота / Парикмахерские и барбершопы'],['Тело','Красота / Массаж и СПА'],['Ногти','Красота / Маникюр и педикюр'],['Общий салон','Красота / Салоны красоты']].map(([title,category],i)=>({...base,id:'test-'+i,title,category}));
rows.push({...base,id:'service-mfc-eniseysk',title:'МФЦ',category:'Госуслуги'});
rows.push({...rows[0],id:'foreign-city',city:'Другой город',title:'Чужой салон'});
export function Fixture(){const [filters,setFilters]=useState({...emptyCatalogFilters,category:'Красота'});const [item,setItem]=useState<Item|null>(null);const actions={favorites:[],toggle:()=>{},open:setItem};
 return <div className="app-shell"><main><button onClick={()=>setItem(rows.find(row=>row.id==='service-mfc-eniseysk')!)}>Открыть МФЦ</button>{item?<><DetailPage item={item} saved={false} toggle={()=>{}} goBack={()=>setItem(null)}/><Card item={item} {...actions}/></>:<CatalogPage kind="services" city={base.city} items={rows.filter(r=>r.city===base.city)} filters={filters} onFiltersChange={setFilters} {...actions}/>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
