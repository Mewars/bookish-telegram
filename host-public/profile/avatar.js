import {c as createClient} from '/wall/supabase-client.js';
const supabase=createClient('https://cptbmepnbzogqkfhflsg.supabase.co','sb_publishable_-LLEHXpg_rqIZ_vUdPnwTQ_0ajeVm37',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const css=document.createElement('style');css.textContent=`
.profile-card .avatar.large-avatar{position:relative;overflow:visible;border-radius:50%!important;aspect-ratio:1/1!important}
.profile-card .avatar.large-avatar>img,.profile-card .avatar.large-avatar .profile-avatar-image{width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important;clip-path:circle(50% at 50% 50%)}
.ryadom-avatar-dialog img[hidden]{display:none!important}
.ryadom-avatar-button{position:absolute;bottom:-7px;right:-7px;display:flex;justify-content:center;align-items:center;width:33px;height:33px;border:2px solid #071622;border-radius:50%;background:#ffcf69;color:#092333;cursor:pointer;box-shadow:0 3px 9px #0006;z-index:2;font-size:17px}
.ryadom-avatar-button:focus-visible,.ryadom-avatar-dialog button:focus-visible{outline:3px solid #f8d670;outline-offset:3px}
.ryadom-avatar-dialog-backdrop{position:fixed;inset:0;z-index:2147483000;background:#010c14d6;display:grid;place-items:center;padding:15px;box-sizing:border-box}
.ryadom-avatar-dialog{width:min(430px,100%);max-height:90dvh;overflow:auto;border:1px solid #597789;border-radius:20px;background:#102e3e;color:#fff8e9;box-sizing:border-box;padding:22px;font:15px/1.55 system-ui;box-shadow:0 24px 60px #0009}
.ryadom-avatar-dialog h2{margin:0 0 10px;font-size:23px}.ryadom-avatar-dialog p{color:#b7d1db}
.ryadom-avatar-dialog input{width:100%;box-sizing:border-box;margin:12px 0;padding:12px;border:1px solid #537080;border-radius:11px}
.ryadom-avatar-dialog img{width:125px;height:125px;object-fit:cover;display:block;margin:10px auto;border:3px solid #f9c967;border-radius:50%}
.ryadom-avatar-dialog .ryadom-avatar-status{text-align:center;min-height:0;color:#e1eaf0}
.ryadom-avatar-dialog .ryadom-avatar-actions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap}
.ryadom-avatar-dialog button{padding:10px 14px;border-radius:11px;border:1px solid #507082;background:#1a4454;color:#fff8e9;font:700 14px system-ui;cursor:pointer}
.ryadom-avatar-dialog button.primary{background:#ffd166;border-color:#ffd166;color:#071622}
`;document.head.append(css);
let cachedUser=null,opening=false;
async function getUser(){const r=await supabase.auth.getUser();cachedUser=r.data?.user||null;return cachedUser}
function ensure(){const avatar=document.querySelector('.profile-card .avatar.large-avatar');if(!avatar||avatar.querySelector('.ryadom-avatar-button'))return;
 const button=document.createElement('button');button.type='button';button.className='ryadom-avatar-button';button.textContent='✎';button.setAttribute('aria-label','Изменить фотографию профиля');button.title='Изменить фото профиля';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openDialog()});avatar.append(button)}
let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;ensure()})});observer.observe(document.getElementById('root')||document.body,{childList:true,subtree:true});ensure();
async function convert(image){if(image.size>20*1024*1024)throw Error('Выберите фотографию размером до 20 МБ.');
 if(!/^image\//.test(image.type)&&!/.+(jpg|jpeg|png|webp|heic|heif)$/i.test(image.name))throw Error('Нужна фотография JPG, PNG, WebP или совместимое изображение iPhone.');
 const objectURL=URL.createObjectURL(image);try{const bitmap=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Этот формат не поддерживается браузером. Попробуйте JPG или PNG.'));im.src=objectURL});
 const factor=Math.min(1,512/Math.max(bitmap.naturalWidth,bitmap.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.naturalWidth*factor));canvas.height=Math.max(1,Math.round(bitmap.naturalHeight*factor));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Не удалось обработать изображение.')),'image/webp',0.82));if(blob.type!=='image/webp'||blob.size>2097152)throw Error('Не удалось подготовить WebP.');return blob;
 }finally{URL.revokeObjectURL(objectURL)}}
async function openDialog(){if(opening)return;opening=true;try{
 const user=await getUser();if(!user){opening=false;alert('Чтобы установить аватарку, войдите в аккаунт «Встречай».');return}
 const backdrop=document.createElement('div');backdrop.className='ryadom-avatar-dialog-backdrop';const dlg=document.createElement('section');dlg.className='ryadom-avatar-dialog';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-label','Изменить фото профиля');
 const h=document.createElement('h2');h.textContent='Фото профиля';const desc=document.createElement('p');desc.textContent='Выберите изображение. Оно автоматически сожмётся до 512 пикселей, а геометки и EXIF не сохранятся.';
 const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';input.setAttribute('aria-label','Выбрать фото профиля');
 const img=document.createElement('img');img.hidden=true;img.alt='Предпросмотр аватарки';img.style.display='none';const status=document.createElement('p');status.setAttribute('role','status');status.className='ryadom-avatar-status';
 const actions=document.createElement('div');actions.className='ryadom-avatar-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';const save=document.createElement('button');save.type='button';save.className='primary';save.textContent='Сохранить фото';save.disabled=true;
 const close=()=>{document.removeEventListener('keydown',esc);backdrop.remove();opening=false};cancel.onclick=close;backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
 const esc=e=>{if(e.key==='Escape'){document.removeEventListener('keydown',esc);close()}};document.addEventListener('keydown',esc);
 let blob=null;input.addEventListener('change',async()=>{status.textContent='Обрабатываем фотографию…';save.disabled=true;try{blob=await convert(input.files[0]);const url=URL.createObjectURL(blob);img.src=url;img.hidden=false;img.style.display='block';img.onload=()=>URL.revokeObjectURL(url);status.textContent='Готово к сохранению';save.disabled=false}catch(e){blob=null;status.textContent=e.message||'Не удалось прочитать фото'}});
 save.addEventListener('click',async()=>{if(!blob)return;save.disabled=true;status.textContent='Загружаем…';try{
 const path=user.id+'/'+crypto.randomUUID()+'.webp';const {error:uploadError}=await supabase.storage.from('ryadom-profile-avatars').upload(path,blob,{contentType:'image/webp',upsert:false});if(uploadError)throw uploadError;
 const {data}=supabase.storage.from('ryadom-profile-avatars').getPublicUrl(path);if(!data?.publicUrl)throw Error('Не получена ссылка на фото');
 const {data:updated,error:updateError}=await supabase.from('profiles').update({avatar_url:data.publicUrl}).eq('id',user.id).select('id');if(updateError)throw updateError;if(!updated?.length)throw Error('Профиль не обновлён: проверьте разрешения');
 status.textContent='Фотография сохранена!';document.querySelectorAll('.profile-card img,.header-profile-button .header-user-avatar').forEach(x=>{x.src=data.publicUrl});setTimeout(()=>location.reload(),350);
 }catch(e){status.textContent=e.message||'Не удалось сохранить фотографию';save.disabled=false}});
 actions.append(cancel,save);dlg.append(h,desc,input,img,status,actions);backdrop.append(dlg);document.body.append(backdrop);input.focus();
 }finally{/* opening remains true while modal is displayed */}}
