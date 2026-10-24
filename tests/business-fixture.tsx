import {createRoot} from 'react-dom/client';
import {BusinessPage} from '../src/business/BusinessPage';
import {OrganizationsPage} from '../src/organizations/OrganizationsPage';
import {useRoute} from '../src/hooks/useRoute';
import '../src/styles.css';
function Fixture(){
 const route=useRoute();const city=route.requestedCity||'Город А';
 return <div className="app-shell" data-section={route.section}><main>{route.section==='business'?<BusinessPage city={city} items={[]} enabled goHome={()=>route.navigate('home',undefined,city)}/>:<OrganizationsPage enabled mode={route.section==='my-applications'?'list':'add'} city={city} designRequested={new URLSearchParams(location.hash.split('?')[1]).get('service')==='design'} goBack={()=>route.navigate('business',undefined,city)} openLogin={()=>route.navigate('login')} openApplications={()=>route.navigate('my-applications')}/>}</main></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
