/* global document, window, matchMedia */
/* Shared by the React site and the independent public wall and classifieds. */
(() => {
 if (document.getElementById('ryadom-back-to-top')) return;
 const button = document.createElement('button');
 button.id = 'ryadom-back-to-top'; button.type = 'button'; button.hidden = true;
 button.setAttribute('aria-label', 'Наверх'); button.title = 'Наверх';
 button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 12l6-6 6 6M12 6v13"/></svg>';
 const update = () => { button.hidden = window.scrollY < 400; };
 button.addEventListener('click', () => {
   window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
   const heading = document.querySelector('main h1,main');
   if (heading) { if (!heading.hasAttribute('tabindex')) { heading.setAttribute('tabindex','-1'); heading.addEventListener('blur',()=>heading.removeAttribute('tabindex'),{once:true}); } heading.focus({preventScroll:true}); }
 });
 document.body.append(button); window.addEventListener('scroll',update,{passive:true}); update();
})();
