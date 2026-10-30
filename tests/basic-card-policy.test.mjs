import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basicPublicItem,basicDescription,showsBasicPhone} from '../src/organizations/basicCard.ts';

const business={id:'private-business',kind:'places',title:'Тестовое кафе',category:'Кафе / Кафе и кофейни',city:'Тестовый город',description:'Старый рекламный текст с номером +7 000 000-00-00',details:'Старые подробности',phone:'+7 000 000-00-00',website:'https://example.org/',vkUrl:'https://vk.ru/example',image:'https://example.org/photo.jpg',address:'Тестовая улица, 1',hours:'10:00–18:00'};
test('private and unreviewed businesses have no phone or commercial links in the public model',()=>{
 const item=basicPublicItem(business);
 for(const key of ['phone','website','vkUrl','details'])assert.equal(item[key],undefined);
 assert(!item.description.includes(business.phone));
 assert.equal(item.address,business.address);assert.equal(item.hours,business.hours);
 assert.equal(item.image,''); // An old hosted photo is not proof of organization permission.
 assert.equal(business.phone,'+7 000 000-00-00'); // Original/admin data is retained.
 assert.deepEqual(basicPublicItem(item),item);
 assert.equal(showsBasicPhone({...business,category:'Госуслуги'}),false);
});
test('reviewed public institution keeps its phone, while a private clinic and state-owned bank do not',()=>{
 const mfc={...business,id:'service-mfc-eniseysk',kind:'services',title:'МФЦ',category:'Госуслуги'};
 assert.equal(basicPublicItem(mfc).phone,business.phone);
 assert.equal(showsBasicPhone({...mfc,id:'unknown-mfc'}),false);
 assert.equal(showsBasicPhone({...business,id:'private-clinic',category:'Здоровье'}),false);
 assert.equal(showsBasicPhone({...business,id:'place-yandex-48049429034'}),false);
});
test('descriptions follow recorded category without invented menus or the old text',()=>{
 assert.match(basicDescription({title:'Музей',category:'Музеи / История'}),/музей/);
 assert(!basicDescription({title:'Памятник',category:'Достопримечательности'}).includes('автосервис'));
 assert.match(basicDescription({title:'СТО',category:'Авто / СТО и автосервисы'}),/автосервис/);
 assert.match(basicDescription({title:'Проба',category:'Кафе / Доставка еды'}),/доставка еды/);
});
test('event information is preserved',()=>{
 const event={...business,kind:'events'};assert.equal(basicPublicItem(event),event);
});
