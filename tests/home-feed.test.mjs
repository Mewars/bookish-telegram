/* global AbortController */
import {URL} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadHomeFeed,hostSectionHref,homePrice} from '../src/home/feed.ts';
function fake(rows={},failure){
 const calls=[],signed=[];
 const client={from(table){const query={then(resolve,reject){return failure===table?Promise.reject(Error('offline')).then(resolve,reject):Promise.resolve({data:rows[table]||[],error:null}).then(resolve,reject);}};
 for(const method of ['select','eq','order','limit','in','abortSignal'])query[method]=(...args)=>{calls.push([table,method,...args]);return query;};return query;},storage:{from(bucket){return {async createSignedUrl(path,ttl){signed.push([bucket,path,ttl]);return {data:{signedUrl:'https://signed.invalid/'+path},error:null};}}}}};
 return {client,calls,signed};
}
const published={id:'ad1',city:'Город А',status:'published',title:'Настоящее объявление',price_rub:100,deal_type:'sell'};
test('public home excludes drafts and other cities even in owner responses, signs only registered public photos',async()=>{
 const f=fake({classifieds:[published,{...published,id:'draft',status:'draft'},{...published,id:'other',city:'Город Б'}],community_posts:[{...published,id:'post'}, {...published,status:'pending'}],classified_photos:[{listing_id:'ad1',object_path:'ad1/photo.webp',slot:0},{listing_id:'draft',object_path:'draft/secret.webp',slot:0}]});
 const feed=await loadHomeFeed(f.client,'Город А',new AbortController().signal);
 assert.deepEqual(feed.listings.map(x=>x.id),['ad1']);assert.deepEqual(feed.posts.map(x=>x.id),['post']);
 assert.equal(feed.listings[0].image,'https://signed.invalid/ad1/photo.webp');
 assert.deepEqual(f.signed,[['ryadom-classified-photos','ad1/photo.webp',600]]);
 for(const table of ['classifieds','community_posts']){
 assert.ok(f.calls.some(c=>c[0]===table&&c[1]==='eq'&&c[2]==='city'&&c[3]==='Город А'));
 assert.ok(f.calls.some(c=>c[0]===table&&c[1]==='eq'&&c[2]==='status'&&c[3]==='published'));
 }
});
test('one failed source does not hide the other and cannot leak arbitrary Storage paths',async()=>{
 const f=fake({classifieds:[published],classified_photos:[{listing_id:'ad1',object_path:'private-user/secret.webp',slot:0}]},'community_posts');
 const feed=await loadHomeFeed(f.client,'Город А',new AbortController().signal);
 assert.equal(feed.postsError,true);assert.equal(feed.listings.length,1);assert.equal(feed.listings[0].image,undefined);assert.equal(f.signed.length,0);
});
test('cancelled city requests return no old-city content',async()=>{
 const f=fake({classifieds:[published]});const controller=new AbortController();controller.abort();
 const result=await loadHomeFeed(f.client,'Город А',controller.signal);assert.deepEqual(result.listings,[]);assert.deepEqual(result.posts,[]);
});
test('unconfigured client yields empty sections and destination links carry the city and record',async()=>{
 const result=await loadHomeFeed(null,'Город Б',new AbortController().signal);assert.equal(result.city,'Город Б');assert.deepEqual(result.posts,[]);
 const url=new URL(hostSectionHref('classifieds','Город Б',{ad:'record'}),'https://ryadomcity.ru');assert.equal(url.searchParams.get('city'),'Город Б');assert.equal(url.searchParams.get('ad'),'record');
 assert.equal(homePrice({...published,price_rub:null}),'По договорённости');assert.equal(homePrice({...published,deal_type:'exchange'}),'Обмен');
});
