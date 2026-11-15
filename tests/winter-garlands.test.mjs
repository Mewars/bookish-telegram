import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GARLAND_SCENES,GARLAND_BULBS,isGarlandCity} from '../src/home/garlandLights.ts';

test('only three approved winter city backgrounds receive tree lights',()=>{
 const cities=['Енисейск','Лесосибирск','Красноярск'];
 assert.deepEqual(Object.keys(GARLAND_SCENES),cities);
 for(const city of cities){
  assert(isGarlandCity(city));
  const {viewBox}=GARLAND_SCENES[city];
  assert(viewBox.startsWith('0 0 '));
  const [, , w, h]=viewBox.split(' ').map(Number);
  const bulbs=GARLAND_BULBS[city];
  assert(bulbs.length>=40,city+' should have many light points');
  assert(bulbs.every(({x,y,r})=>x>=0&&x<=w&&y>=0&&y<=h&&r>0));
  assert(new Set(bulbs.map(x=>x.color)).size>=4);
  assert.deepEqual(new Set(bulbs.map(x=>x.mode)),new Set(['soft','spark','wave']));
  assert(bulbs.every(x=>x.duration>1&&x.duration<15&&x.delay<=0));
  assert(new Set(bulbs.map(x=>x.delay)).size>bulbs.length*.75);
 }
 for(const city of ['Город А','Москва',''])assert(!isGarlandCity(city));
});

test('holiday lights match the reference photo coordinates rather than screen pixels',()=>{
 assert.equal(GARLAND_SCENES['Енисейск'].viewBox,'0 0 1606 979');
 assert.equal(GARLAND_SCENES['Лесосибирск'].viewBox,'0 0 1586 992');
 assert.equal(GARLAND_SCENES['Красноярск'].viewBox,'0 0 1586 992');
 for(const city of Object.keys(GARLAND_SCENES)){
  const lights=GARLAND_BULBS[city];
  assert(lights.every(x=>x.x>=1380),city+' has no lights in the left-hand city skyline');
 }
});
