(()=>{
 'use strict';
 const directions={
   website:{icon:'₽',title:'Развитие «Встречай»',desc:'Хостинг, поддержка, обновления и новые возможности городского сервиса.'},
   humanitarian:{icon:'♡',title:'Гуманитарная поддержка СВО',desc:'Помощь участникам СВО и их семьям: гуманитарные нужды и социальная поддержка.'},
   animals:{icon:'🐾',title:'Помощь приютам животных',desc:'Корм, лечение, содержание собак и кошек в приютах.'},
   city:{icon:'⌂',title:'Помощь жителям города',desc:'Адресная помощь нуждающимся и полезные городские инициативы.'},
   other:{icon:'✦',title:'Другие добрые дела',desc:'Общественные проекты и новые направления помощи.'}
 };
 const grid=document.getElementById('directions');
 const pay=document.getElementById('payment-content');
 const heading=document.getElementById('payment-heading');
 const detail=document.getElementById('payment-description');
 const settings=window.RYADOM_DONATION_CONFIG||{};
 const isUseful=(s)=>typeof s==='string'&&s.trim().length>0;
 const $=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el};
 let selected='website';
 function paymentLink(url){
   if(!isUseful(url))return false;
   try{
     const parsed=new URL(url);
     if(parsed.protocol!=='https:')return false;
     const providers=['nspk.ru','yookassa.ru','sber.ru','sberbank.ru','tbank.ru','tinkoff.ru','alfabank.ru','alfa-bank.ru','vtb.ru','gazprombank.ru','psbank.ru'];
     return providers.some(domain=>parsed.hostname===domain||parsed.hostname.endsWith('.'+domain));
   }catch{return false}
 }
 function makeMethod(title,lines,copyText,validUrl){
   const card=$('article','method');card.append($('strong','',title));
   const data=$('div','details');for(const line of lines)data.append($('div','',line));card.append(data);
   if(copyText){
     const b=$('button','', 'Скопировать реквизиты');b.type='button';
     const status=$('div','copy-success');status.setAttribute('aria-live','polite');
     b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(copyText);status.textContent='Скопировано';}
       catch{status.textContent='Скопируйте реквизиты вручную — браузер запретил копирование';}});
     card.append(b,status);
   }
   if(validUrl){const a=$('a','',title==='Ссылка российского банка'?'Открыть оплату':'Открыть ссылку');a.href=validUrl;a.target='_blank';a.rel='noopener noreferrer';card.append(a)}
   return card;
 }
 function render(){
   grid.replaceChildren();
   for(const [key,d] of Object.entries(directions)){
     const b=$('button','direction'+(key===selected?' active':''));b.type='button';b.setAttribute('aria-pressed',String(key===selected));
     b.append($('span','category-icon',d.icon),$('strong','',d.title),$('span','',d.desc),$('span','state','Выбрать направление'));
     b.addEventListener('click',()=>{selected=key;render();document.getElementById('payment-panel').scrollIntoView({behavior:'smooth',block:'start'});});
     grid.append(b);
   }
   heading.textContent=directions[selected].title;
   detail.textContent=directions[selected].desc;
   pay.replaceChildren();
   const conf=settings[selected]||{};
   const card=conf.card||{},sbp=conf.sbp||{},link=conf.link||{};
   const cardReady=isUseful(card.number)&&isUseful(card.bank)&&isUseful(card.holder)&&/^[\d\s-]{16,24}$/.test(card.number);
   const sbpReady=isUseful(sbp.phone)&&isUseful(sbp.bank)&&/^\+?[\d\s()-]{10,22}$/.test(sbp.phone);
   const linkReady=paymentLink(link.url);
   const qrReady=paymentLink(conf.qrUrl);
   if(!cardReady&&!sbpReady&&!linkReady&&!qrReady){
     const box=$('div','coming-soon');box.append($('strong','','Реквизиты скоро появятся'),
       $('p','', 'Сбор по этому направлению пока не открыт. Когда реквизиты будут подтверждены, здесь появятся карта получателя, СБП и доступные ссылки российских банков.'));
     pay.append(box);return;
   }
   const methods=$('div','payment-methods');
   if(cardReady){const number=card.number.replace(/\s+/g,' ').trim();methods.append(makeMethod('₽ По номеру карты',[card.bank,number,card.holder],`Карта: ${number}\nБанк: ${card.bank}\nПолучатель: ${card.holder}`));}
   if(sbpReady){methods.append(makeMethod('↗ Через СБП',[sbp.phone,sbp.bank],`СБП: ${sbp.phone}\nБанк: ${sbp.bank}`));}
   if(linkReady){const m=makeMethod('Ссылка российского банка',[isUseful(link.provider)?link.provider:'Платёжная ссылка'],null,link.url);methods.append(m);}
   if(qrReady){const m=makeMethod('▦ QR для перевода',['Откройте приложение российского банка и отсканируйте QR.'],null,null);
     const img=$('img');img.src=conf.qrUrl;img.alt='QR-код для перевода';img.loading='lazy';m.append(img);methods.append(m);}
   pay.append(methods,$('div','notice','Проверяйте название получателя в приложении банка перед переводом. Сайт не запрашивает данные вашей банковской карты.'));
 }
 render();
})();
