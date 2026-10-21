/* RYADOM unified navigation and usability. Keep root player mounted.
 * Sections are rendered in an accessible same-origin iframe overlay.
 * Direct browser navigation/refresh cannot keep a previous page's audio alive.
 */
(() => {
  'use strict';
  if (window.top !== window.self) return;
  const root = document.getElementById('root');
  if (!root) return;
  const sections = new Set(['wall', 'classifieds', 'donate', 'notifications']);
  const allowedPath = (raw) => {
    try {
      const target = new URL(raw, location.href);
      if (target.origin !== location.origin) return null;
      const first = target.pathname.split('/').filter(Boolean)[0];
      if (!sections.has(first)) return null;
      if (!/^\/(wall|classifieds|donate|notifications)\/?$/.test(target.pathname)) return null;
      return target.pathname + target.search + target.hash;
    } catch { return null; }
  };
  const homePath = (raw) => {
    try {
      const target = new URL(raw, location.href);
      return target.origin === location.origin && target.pathname === '/';
    } catch { return false; }
  };
  const css = document.createElement('style');
  css.id = 'ryadom-shell-20261018';
  css.textContent = `
    /* The built-in floating Aa control remains operative, but is now
       activated through a labelled button in the footer. */
    .accessibility-button--fixed {display:none!important}
    .ryadom-footer-accessibility {display:inline-flex;align-items:center;min-height:44px;
      border:0;background:transparent;color:var(--muted,#b5cad4);cursor:pointer;
      padding:6px 0;font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px}
    .ryadom-footer-accessibility:hover{color:var(--text,#fff8e9)}
    .ryadom-footer-accessibility:focus-visible{outline:3px solid #ffd166;outline-offset:3px}
    /* The bell is a header action immediately to the RIGHT of the avatar. */
    #root .ryadom-notif-trigger.ryadom-bell-header {position:static!important;inset:auto!important;
      display:inline-flex;align-items:center;justify-content:center;gap:1px;flex-shrink:0;
      width:auto;min-width:38px;height:38px;padding:5px 7px;border-radius:99px;
      font:700 17px system-ui;box-shadow:none!important;z-index:auto!important;
      margin:0!important;vertical-align:middle;transform:none!important}
    #root .ryadom-notif-trigger.ryadom-bell-header .ryadom-notif-count{font-size:10px}
    .ryadom-notif-popover{top:var(--ryadom-bell-popover-top,83px)!important;
      bottom:auto!important;right:var(--ryadom-bell-popover-right,14px)!important;
      z-index:20001!important}
    .ryadom-shell-overlay{position:fixed;inset:0;z-index:99990;background:#071622;
      display:flex;flex-direction:column;color:#fff8e9}
    .ryadom-shell-bar{flex:none;display:flex;gap:10px;align-items:center;
      min-height:54px;padding:8px 16px;background:#0d2634;
      border-bottom:1px solid #36566a;font:600 14px system-ui}
    .ryadom-shell-bar button{cursor:pointer;min-height:36px;border:1px solid #61808f;
      background:#163747;color:#fff8e9;padding:7px 14px;border-radius:12px;font:inherit}
    .ryadom-shell-bar button:hover{background:#244b5f}
    .ryadom-shell-bar .ryadom-shell-back{background:#ffd166;border-color:#ffd166;color:#061b2a}
    .ryadom-shell-music{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
    .ryadom-shell-music button{min-width:36px;padding:6px 8px}
    .ryadom-shell-music input{width:72px;min-width:0;accent-color:#ffd166}
    .ryadom-shell-music [hidden]{display:none!important}
    .ryadom-shell-bar button:focus-visible{outline:3px solid #ffd166;outline-offset:3px}
    .ryadom-shell-iframe{flex:1;width:100%;min-height:0;border:0;background:#071622}
    @media(max-width:899px){
      #root .app-header .ryadom-notif-trigger.ryadom-bell-header{min-width:32px;
        width:32px;height:32px;padding:3px;font-size:16px}
      #root .app-header .ryadom-notif-trigger.ryadom-bell-header .ryadom-notif-count{
        min-width:15px;padding:1px 3px;font-size:9px}
      .ryadom-shell-bar{gap:6px;padding:6px 9px}
      .ryadom-shell-bar button{padding:6px 9px;font-size:12px}
      .ryadom-shell-music{gap:4px}
      .ryadom-shell-music input{width:54px}
    }
    @media(max-width:520px){
      #root .app-header {gap:6px!important;padding-left:10px!important;padding-right:10px!important}
      #root .app-header .brand-logo-pin{--brand-logo-width:108px!important}
    }
  `;
  document.head.append(css);

  let overlay=null, frame=null, beforeScroll='', beforeFocus=null;
  let musicState=null, musicControls=null;
  const musicCommand=(action,extra={})=>window.dispatchEvent(new CustomEvent('ryadom:music-command',{detail:{action,...extra}}));
  function syncMusicControls(){
    if(!musicControls)return;
    const {toggle,mute,volume}=musicControls;
    const status=musicState?.status||'idle';
    const available=status!=='idle'&&(musicState?.isOpen||status==='playing'||status==='loading');
    toggle.hidden=mute.hidden=volume.hidden=!available;
    const label=status==='loading'?'Отменить подключение радио':musicState?.isPlaying?'Приостановить Музыку рядом':'Включить Музыку рядом';
    toggle.textContent=status==='loading'?'…':musicState?.isPlaying?'❚❚':'▶';
    toggle.setAttribute('aria-label',label);toggle.title=label;
    mute.textContent=musicState?.isMuted?'🔇':'♪';
    mute.setAttribute('aria-label',musicState?.isMuted?'Включить звук':'Отключить звук');
    mute.setAttribute('aria-pressed',String(Boolean(musicState?.isMuted)));
    volume.value=String(Math.round((musicState?.volume??0.6)*100));
    volume.setAttribute('aria-valuetext',volume.value+'%');
  }
  window.addEventListener('ryadom:music-state',event=>{
    if(!event.detail||typeof event.detail!=='object')return;
    musicState=event.detail;syncMusicControls();
  });
  musicCommand('request-state');
  const bellSelector='button.ryadom-notif-trigger';
  const updateBellPopover = () => {
    const button=document.querySelector(`${bellSelector}.ryadom-bell-header`);
    if(!button) return;
    const rect=button.getBoundingClientRect();
    const popup=document.querySelector('.ryadom-notif-popover');
    if(!popup) return;
    document.documentElement.style.setProperty('--ryadom-bell-popover-top',
      `${Math.min(window.innerHeight-100,Math.max(8,rect.bottom+8))}px`);
    document.documentElement.style.setProperty('--ryadom-bell-popover-right',
      `${Math.max(12,window.innerWidth-rect.right)}px`);
  };
  let bellRef=null;
  function adaptHeader(){
    const profile=document.querySelector('.app-header .header-profile-button') ||
                  document.querySelector('.web-header-actions .web-profile-button');
    const discoveredBell=document.querySelector(bellSelector);
    if(discoveredBell) bellRef=discoveredBell;
    const bell=bellRef;
    if(profile && bell && profile.nextElementSibling !== bell){
      profile.insertAdjacentElement('afterend',bell);
      bell.classList.add('ryadom-bell-header');
    }
    if(profile && bell) updateBellPopover();
  }
  function adaptFooter(){
    const legal=document.querySelector('.web-footer .legal-links') ||
      document.querySelector('.legal-links') ||
      document.querySelector('.web-footer') || document.querySelector('.content-footer');
    if(!legal || legal.querySelector('.ryadom-footer-accessibility')) return;
    const original=document.querySelector('.accessibility-button--fixed');
    if(!original) return;
    const btn=document.createElement('button');btn.type='button';
    btn.className='ryadom-footer-accessibility';
    btn.textContent='Версия для слабовидящих';
    btn.setAttribute('aria-haspopup','dialog');
    btn.setAttribute('aria-controls','ryadom-accessibility-dialog');
    btn.addEventListener('click',()=>original.click());
    legal.append(btn);
  }
  let updateQueued=false;
  function queueUpdate(){
    if(updateQueued) return;
    updateQueued=true;
    requestAnimationFrame(()=>{updateQueued=false;adaptHeader();adaptFooter()});
  }
  const observer=new MutationObserver(queueUpdate);
  observer.observe(document.body,{subtree:true,childList:true});
  queueUpdate();
  window.addEventListener('resize',updateBellPopover,{passive:true});
  window.addEventListener('scroll',updateBellPopover,{passive:true});

  function framePath(path){
    const u=new URL(path,location.origin);
    u.searchParams.set('ryadom_embed','1');
    return u.pathname+u.search+u.hash;
  }
  function injectFrameSupport(){
    if(!frame?.contentDocument)return;
    try{
      const doc=frame.contentDocument;
      const style=doc.createElement('style');
      style.textContent='.ryadom-notif-trigger,.ryadom-notif-popover,.ryadom-push-consent{display:none!important}';
      doc.head.append(style);
      doc.addEventListener('click',event=>{
        const a=event.target instanceof doc.defaultView.Element?event.target.closest('a[href]'):null;
        if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.shiftKey||event.altKey||event.metaKey||a.target==='_blank'||a.hasAttribute('download'))return;
        const dest=allowedPath(a.href);
        if(dest){event.preventDefault();event.stopImmediatePropagation();openSection(dest);return}
        if(homePath(a.href)){
          event.preventDefault();event.stopImmediatePropagation();closeSection();
          const target=new URL(a.href,location.origin);
          if(target.hash)location.hash=target.hash;
        }
      },true);
    }catch(e){console.warn('RYADOM section frame navigation:',e)}
  }
  function closeSection(){
    if(!overlay) return;
    overlay.remove();overlay=null;frame=null;musicControls=null;
    document.body.style.overflow=beforeScroll;
    document.removeEventListener('keydown',onEscape,true);
    if(beforeFocus instanceof HTMLElement && beforeFocus.isConnected)beforeFocus.focus({preventScroll:true});
  }
  function onEscape(event){if(event.key==='Escape'){event.preventDefault();closeSection()}}
  function openSection(path){
    const dest=allowedPath(path);
    if(!dest) return false;
    if(overlay && frame){frame.src=framePath(dest);return true}
    beforeFocus=document.activeElement;
    beforeScroll=document.body.style.overflow;
    overlay=document.createElement('section');overlay.className='ryadom-shell-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Городской раздел РЯДОМ');
    const bar=document.createElement('div');bar.className='ryadom-shell-bar';
    const close=document.createElement('button');close.type='button';
    close.className='ryadom-shell-back';close.textContent='← На главную';
    close.onclick=closeSection;
    const controls=document.createElement('div');controls.className='ryadom-shell-music';
    controls.setAttribute('role','group');controls.setAttribute('aria-label','Музыка рядом');
    const toggle=document.createElement('button');toggle.type='button';toggle.hidden=true;
    toggle.className='ryadom-shell-music-toggle';toggle.onclick=()=>musicCommand('toggle');
    const mute=document.createElement('button');mute.type='button';mute.hidden=true;
    mute.onclick=()=>musicCommand('toggle-mute');
    const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.hidden=true;
    volume.setAttribute('aria-label','Громкость музыки');
    volume.oninput=()=>musicCommand('set-volume',{value:Number(volume.value)/100});
    const open=document.createElement('button');open.type='button';open.textContent='♫';
    open.setAttribute('aria-label','Открыть Музыку рядом');open.title='Настройки музыки';
    open.onclick=()=>{closeSection();musicCommand('open-player')};
    controls.append(toggle,mute,volume,open);bar.append(close,controls);
    musicControls={toggle,mute,volume};syncMusicControls();musicCommand('request-state');
    frame=document.createElement('iframe');frame.className='ryadom-shell-iframe';
    frame.title='Раздел РЯДОМ';frame.src=framePath(dest);
    frame.addEventListener('load',injectFrameSupport);
    overlay.append(bar,frame);
    document.body.append(overlay);document.body.style.overflow='hidden';
    document.addEventListener('keydown',onEscape,true);
    close.focus();
    return true;
  }
  // Capture BEFORE the existing notification widget's donate-only handler.
  document.addEventListener('click',event=>{
    const a=event.target instanceof Element?event.target.closest('a[href]'):null;
    if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||a.target==='_blank'||a.hasAttribute('download'))return;
    const path=allowedPath(a.href);
    if(path){event.preventDefault();event.stopImmediatePropagation();openSection(path)}
  },true);
  window.ryadomOpenSection=openSection;
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || !event.data || event.data.type!=='RYADOM_SHELL_NAVIGATE')return;
    const path=event.data.path;
    if(allowedPath(path))openSection(path);
    else if(homePath(path))closeSection();
  });
})();
