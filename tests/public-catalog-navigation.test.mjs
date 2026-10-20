import assert from 'node:assert/strict';
import {test} from 'node:test';
import {URLSearchParams} from 'node:url';
import {catalogHash,detailHash,emptyCatalogFilters,hashParts,matchesCatalogFilters,readCatalogFilters,routeCity,safeCatalogReturn} from '../src/navigation/catalogRoute.ts';
import {ensureRouteCity,getRoute,navigateToRoute,returnToCatalog,updateCatalogFilters} from '../src/hooks/useRoute.ts';

test('card and related card return to the original filtered public list in each city',()=>{
  const filters={query:'чай & кофе',category:'Еда',subcategory:'Кофейни',when:'Все даты'};
  for(const city of ['Енисейск','Лесосибирск','Будущий город']) {
    const list=catalogHash('places',city,filters);
    const card=detailHash('places','place/с пробелом',city,list);
    assert.equal(routeCity(card),city);
    assert.equal(hashParts(card).id,'place/с пробелом');
    assert.equal(safeCatalogReturn(card,'places',city),list);
    assert.deepEqual(readCatalogFilters(safeCatalogReturn(card,'places',city)),filters);
    const related=detailHash('services','related',city,card);
    assert.equal(safeCatalogReturn(related,'services',city),list);
  }
});

test('unsafe or different-city return destinations always fall back to a public list',()=>{
  for(const target of ['#/admin','#/photo-admin','#/admin-preview','#/profile',
    '#/places/detail?city=Енисейск','#/places?city=Лесосибирск',
    'https://example.org/#/places','//example.org','javascript:alert(1)',
    '#/places/extra/path?city=Енисейск']) {
    const hash='#/places/card?'+new URLSearchParams({city:'Енисейск',return:target});
    assert.equal(safeCatalogReturn(hash,'places','Енисейск'),catalogHash('places','Енисейск'));
  }
  // Even a permitted list cannot carry a second private return destination.
  const nested='#/places?'+new URLSearchParams({city:'Енисейск',return:'#/admin'});
  const hash='#/places/card?'+new URLSearchParams({return:nested});
  assert.equal(safeCatalogReturn(hash,'places','Енисейск'),catalogHash('places','Енисейск'));
});

test('direct detail opens and cards opened outside a catalog use the item catalog',()=>{
  for(const kind of ['places','events','services']) {
    for(const from of ['#/home','#/favorites','#/admin','#/photo-admin']) {
      const card=detailHash(kind,'id','Новый город',from);
      assert.equal(safeCatalogReturn(card,kind,'Новый город'),catalogHash(kind,'Новый город'));
    }
    assert.equal(safeCatalogReturn('#/'+kind+'/id',kind,'Енисейск'),catalogHash(kind,'Енисейск'));
  }
});

test('filter normalization and matching preserve category, subcategory and date without invented taxonomy',()=>{
  const today={kind:'events',category:'Культура / Выставки',dateOffset:0};
  const filters={...emptyCatalogFilters,category:'Культура',subcategory:'Выставки',when:'Сегодня'};
  assert.equal(matchesCatalogFilters(today,filters),true);
  assert.equal(matchesCatalogFilters({...today,dateOffset:1},filters),false);
  assert.equal(matchesCatalogFilters({...today,category:'Культура / Кино'},filters),false);
  assert.equal(matchesCatalogFilters({...today,kind:'places'},filters),true,'Dates apply only to events');
  const bad='#/places?'+new URLSearchParams({q:'x'.repeat(201),city:'x'.repeat(101),category:'\u0001',when:'bogus'});
  assert.deepEqual(readCatalogFilters(bad),emptyCatalogFilters);
  assert.equal(routeCity(bad),'');
});

test('route parser rejects detail IDs attached to private or unknown routes',()=>{
  const original=globalThis.window;
  try {
    for(const hash of ['#/admin/known-card','#/photo-admin/known-card','#/profile/known-card','#/unknown/id','#/places/id/extra']) {
      globalThis.window={location:{hash}};
      assert.equal(getRoute().section,'home');
      assert.equal(getRoute().id,undefined);
    }
    globalThis.window={location:{hash:'#/admin'}};
    assert.equal(getRoute().section,'admin','Normal admin route still reaches the existing Auth/RLS gate');
    globalThis.window={location:{hash:'#/places/known-card?city=Лесосибирск'}};
    assert.equal(getRoute().section,'places');
    assert.equal(getRoute().requestedCity,'Лесосибирск');
  }finally{globalThis.window=original;}
});

test('filter edits replace the current list history entry; opening and returning use safe native hash navigation',()=>{
  const original=globalThis.window,oldEvent=globalThis.HashChangeEvent;
  const replaced=[],events=[];
  try {
    globalThis.HashChangeEvent=class {constructor(type){this.type=type;}};
    globalThis.window={location:{hash:'#/places'},scrollTo(){},
      history:{state:{other:'preserved'},replaceState(state,_title,hash){replaced.push({state,hash});globalThis.window.location.hash=hash;}},
      dispatchEvent(event){events.push(event.type);}};
    ensureRouteCity('Енисейск');
    assert.equal(routeCity(globalThis.window.location.hash),'Енисейск');
    ensureRouteCity('Енисейск');
    assert.equal(replaced.length,1,'Already stamped city must not modify history');
    updateCatalogFilters('places','Енисейск',{...emptyCatalogFilters,query:'музей'});
    const list=globalThis.window.location.hash;
    assert.equal(replaced.length,2);
    assert.deepEqual(replaced[0].state,{other:'preserved'});
    assert.deepEqual(events,['hashchange','hashchange']);
    navigateToRoute('places','id','Енисейск');
    assert.equal(hashParts(globalThis.window.location.hash).id,'id');
    returnToCatalog('places','Енисейск');
    assert.equal(globalThis.window.location.hash,list);
    navigateToRoute('login',undefined,'Енисейск');
    assert.equal(globalThis.window.location.hash,'#/login');
    const writes=replaced.length;
    ensureRouteCity('Енисейск');
    assert.equal(replaced.length,writes,'Login/OAuth fragment must not be rewritten');
    navigateToRoute('profile',undefined,'Енисейск');
    assert.equal(globalThis.window.location.hash,'#/profile');
  }finally{globalThis.window=original;globalThis.HashChangeEvent=oldEvent;}
});
