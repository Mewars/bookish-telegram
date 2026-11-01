import {useEffect,useRef,useState} from 'react';
import './winter.css';

export function WinterSnow(){
 const root=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(true);
 const [tabVisible,setTabVisible]=useState(!document.hidden);
 useEffect(()=>{
  const node=root.current;if(!node)return;
  const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
  observer.observe(node);
  const update=()=>setTabVisible(!document.hidden);
  document.addEventListener('visibilitychange',update);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);};
 },[]);
 return <div ref={root} className="winter-snow" aria-hidden="true" data-paused={!visible||!tabVisible}>
  <div className="winter-snow-flakes" aria-hidden="true"><span/><span/><span/></div>
 </div>;
}
