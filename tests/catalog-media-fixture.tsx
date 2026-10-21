import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {MediaImage} from '../src/components/MediaImage';
export function Fixture(){
 const [src,setSrc]=useState('');
 return <main><div style={{width:280,height:190}}><MediaImage src={src} alt="Тестовая фотография" eager/></div>
 <button onClick={()=>setSrc('/tests/photo-valid.png')}>Показать фото</button>
 <button onClick={()=>setSrc('/tests/photo-broken.png')}>Недоступное фото</button>
 <button onClick={()=>setSrc('/src/assets/city.svg')}>Старая иллюстрация</button></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
