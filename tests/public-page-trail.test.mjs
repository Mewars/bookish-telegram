/* global location, sessionStorage */
import assert from 'node:assert/strict';
import {test} from 'node:test';
const origin='https://ryadomcity.ru';
const values=new Map();
globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
globalThis.location={origin,href:origin+'/#/home',pathname:'/',assign:v=>{location.href=origin+v;}};
globalThis.window={addEventListener:()=>{}};
globalThis.document={querySelector:()=>null};
const {safePublicUrl,rememberPublicPage,goPublicBack}=await import('../public/ui/navigation.js');
test('safe trail rejects admin, foreign origins, tokens and private standalone views',()=>{
 for(const path of ['/#/admin','/#/photo-admin','/#/admin-preview','https://evil.test/#/places','/wall/?view=admin','/classifieds/?view=moderation','/classifieds/?view=chat','/#/home?access_token=secret','/friends-api/'])assert.equal(safePublicUrl(path),null,path);
});
test('back preserves public filters, related card and city; browser traversal trims revisits',()=>{
 values.clear();const list='/#/places?city=Будущий&category=Кафе&subcategory=Кофейни',first='/#/places/first?city=Будущий',second='/#/places/second?city=Будущий';
 for(const path of [list,first,second]){location.href=origin+path;rememberPublicPage();}
 goPublicBack();assert.equal(location.href,new URL(origin+first).href);rememberPublicPage();goPublicBack();assert.equal(location.href,new URL(origin+list).href);
 values.clear();location.href=origin+'/#/places/straight?return=%23%2Fadmin';rememberPublicPage();goPublicBack('/#/places?city=Будущий');assert.equal(location.href,new URL(origin+'/#/places?city=Будущий').href);
});
test('filter edits replace one trail entry and unavailable storage falls back safely',()=>{
 values.clear();for(const path of ['/#/home','/#/places?q=a','/#/places?q=ab']){location.href=origin+path;rememberPublicPage();}goPublicBack();assert.equal(location.href,origin+'/#/home');
 sessionStorage.getItem=()=>{throw Error('blocked')};sessionStorage.setItem=()=>{throw Error('blocked')};goPublicBack('/#/admin');assert.equal(location.href,origin+'/#/home');
});
