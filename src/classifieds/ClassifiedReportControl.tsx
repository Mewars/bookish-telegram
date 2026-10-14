import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { submitClassifiedReport } from './repository';

export function ClassifiedReportControl({listingId,userId,openLogin}:{
  listingId:string;userId:string|null;openLogin:()=>void;
}) {
  const [expanded,setExpanded]=useState(false);
  const [reason,setReason]=useState('');
  const [sending,setSending]=useState(false);
  const [result,setResult]=useState('');
  return <div className="classified-report-control">
    <button type="button" className="classified-report-trigger" onClick={()=>{
      if(!userId){openLogin();return;}
      setExpanded(value=>!value);
    }} aria-expanded={expanded}>Пожаловаться</button>
    {expanded && !result && <form onSubmit={event=>{
      event.preventDefault();
      if(sending)return;
      setSending(true);
      void submitClassifiedReport(supabase,listingId,reason).then(()=>{
        setResult('Жалоба отправлена. Редактор города рассмотрит её.');
        setExpanded(false);
      }).catch(error=>setResult(error instanceof Error?error.message:'Не удалось отправить жалобу.'))
        .finally(()=>setSending(false));
    }}>
      <label>Почему это объявление нарушает правила?
        <textarea required minLength={10} maxLength={1000} rows={3}
          value={reason} onChange={e=>setReason(e.target.value)}
          placeholder="Например, обман, запрещённый товар, оскорбления…"/>
      </label>
      <button type="submit" disabled={sending || reason.trim().length<10}>Отправить жалобу</button>
    </form>}
    {result && <p role="status" className="classified-report-result">{result}</p>}
  </div>;
}
