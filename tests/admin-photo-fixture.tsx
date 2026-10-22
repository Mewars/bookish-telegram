import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdminPage} from '../src/admin/AdminPage';
import {AuthContext} from '../src/auth/context';
const actor=localStorage.getItem('catalog-actor')||'owner';
createRoot(document.getElementById('root')!).render(<AuthContext.Provider value={{state:{status:'authenticated',user:{id:actor},profile:null,identities:[]},error:null,signOut:async()=>{},updateProfile:async()=>false}}>
 <AdminPage enabled cityDirectoryEnabled={false} cities={[{name:'Город А',slug:'city-a'},{name:'Город Б',slug:'city-b'}] as never} refreshCities={()=>{}} goHome={()=>{}} openLogin={()=>{}}/>
</AuthContext.Provider>);
