import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ResidentDirectory} from '../src/friends/ResidentDirectory';
import type {NearbyClient} from '../src/friends/repository';
import '../src/friends/friends.css';
let publicCity:string|null=null;let pending=false;
const client:NearbyClient={rpc:async(name,p={})=>{
 if(name==='nearby_directory_opt_in')publicCity=p.p_enabled?String(p.p_city):null;
 else if(name==='nearby_request_person')pending=true;
 else if(name==='nearby_directory')return {data:p.p_city==='Город А'?[{id:'synthetic-person',name:'Тестовый житель',city:'Город А',relation:pending?'outgoing':'none'}]:[],error:null};
 else throw Error('Unexpected method: no location request is allowed in the directory');
 return {data:null,error:null};
}};
function Fixture(){const [city,setCity]=useState('Город А'),[active,setActive]=useState(publicCity);return <main style={{maxWidth:800,margin:'20px auto'}}><label>Тестовый город<select aria-label="Тестовый город" value={city} onChange={e=>setCity(e.target.value)}><option>Город А</option><option>Город Б</option></select></label><ResidentDirectory key={city} client={client} city={city} name="Автор теста" publicCity={active} refresh={async()=>setActive(publicCity)} openRequests={()=>{}}/></main>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
