// Shared by React and the standalone wall/classifieds. No secrets live here.
const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise;
export async function antiSpamConfig(client){
 const {data,error}=await client.rpc('antispam_public_config');
 // Staged deployment: until the SQL is installed the existing forms still work.
 if(error?.code==='PGRST202'||error?.code==='42883')return {auth_enabled:false,content_enabled:false,site_key:null};
 if(error||!data||typeof data.auth_enabled!=='boolean'||typeof data.content_enabled!=='boolean')throw Error('Не удалось загрузить проверку безопасности. Повторите отправку позднее.');
 return data;
}
async function loadWidget(){
 if(window.turnstile)return window.turnstile;
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=SCRIPT;script.async=true;script.defer=true;
  const timer=setTimeout(()=>{script.remove();scriptPromise=undefined;reject(Error('Проверка безопасности недоступна. Попробуйте ещё раз.'));},15000);
  script.onload=()=>{clearTimeout(timer);if(window.turnstile)resolve(window.turnstile);else{scriptPromise=undefined;reject(Error('Не удалось открыть проверку безопасности.'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();scriptPromise=undefined;reject(Error('Не удалось загрузить проверку безопасности.'));};
  document.head.append(script);
 });
 return scriptPromise;
}
export async function challenge(siteKey,action){
 const turnstile=await loadWidget();
 return new Promise((resolve,reject)=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.setAttribute('aria-label','Проверка безопасности');
  dialog.style.cssText='width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:18px;border:1px solid #b99440;border-radius:18px;background:#102b4a;color:#fff;max-width:100%;';
  const title=document.createElement('h2');title.textContent='Подтвердите, что вы не робот';title.style.cssText='font:600 18px/1.4 system-ui;margin:0 0 16px';
  const container=document.createElement('div');
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';cancel.style.cssText='margin-top:14px;padding:9px 16px;border-radius:10px;cursor:pointer';
  dialog.append(title,container,cancel);document.body.append(dialog);dialog.showModal();cancel.focus();
  let widget,done=false;
  const finish=(error,token)=>{if(done)return;done=true;clearTimeout(timer);if(widget!==undefined)turnstile.remove(widget);dialog.close();dialog.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();if(error)reject(error);else resolve(token);};
  const timer=setTimeout(()=>finish(Error('Время проверки истекло. Повторите отправку.')),180000);
  cancel.onclick=()=>finish(Error('Проверка отменена. Введённые данные сохранены в форме.'));
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel.click();});
  try{widget=turnstile.render(container,{sitekey:siteKey,action,language:'ru',theme:'dark',size:'flexible',
   callback:token=>finish(null,token),
   'expired-callback':()=>finish(Error('Проверка устарела. Повторите отправку.')),
   'error-callback':()=>{finish(Error('Проверка не пройдена. Попробуйте ещё раз.'));return true;},
  });}catch{finish(Error('Не удалось открыть проверку безопасности.'));}
 });
}
export async function verifyHuman(client,action,resourceId=null){
 const config=await antiSpamConfig(client),auth=action==='auth';
 if(!(auth?config.auth_enabled:config.content_enabled))return undefined;
 if(!config.site_key)throw Error('Проверка безопасности временно недоступна.');
 const token=await challenge(config.site_key,action);
 if(auth)return token;
 const {data,error}=await client.functions.invoke('ryadom-antispam',{body:{token,action,resource_id:resourceId}});
 if(error||data?.verified!==true)throw Error('Не удалось подтвердить проверку безопасности. Повторите отправку.');
 return undefined;
}
