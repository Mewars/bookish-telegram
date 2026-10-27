import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../src/auth/context';
import {WebFooter} from '../src/components/web/WebFooter';
import type {AuthState} from '../src/types/auth';
import '../src/styles.css';
function Fixture(){
 const [actor,setActor]=useState('guest'),[city,setCity]=useState('Город А');
 const state:AuthState=actor==='guest'?{status:'guest',user:null,profile:null,identities:[]}:{status:'authenticated',user:{id:actor},profile:null,identities:[]};
 return <AuthContext.Provider value={{state,error:null,signOut:async()=>{},updateProfile:async()=>false}}>
  <label>Тестовая роль<select id="test-actor" value={actor} onChange={e=>setActor(e.target.value)}><option>guest</option><option>resident</option><option>editor</option><option>owner</option></select></label>
  <label>Тестовый город<select value={city} onChange={e=>setCity(e.target.value)}><option>Город А</option><option>Город Б</option></select></label>
  <main style={{minHeight:1600}}><h1>Тест страницы</h1></main><WebFooter city={city} region="Регион" navigate={()=>{}}/>
 </AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
