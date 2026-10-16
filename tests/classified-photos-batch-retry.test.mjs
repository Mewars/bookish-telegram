/* global File, Blob, queueMicrotask */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { URL } from 'node:url';
import { uploadClassifiedPhotos } from '../src/classifieds/photos.ts';

const listing='11111111-1111-4111-8111-111111111111';
const files=['first.jpg','second.jpg','third.jpg'].map(name=>new File(['synthetic'],name,{type:'image/jpeg'}));

// Simulate the browser decoder/canvas only. Exercise the real upload service,
// image preparation, reservation order and Storage calls with synthetic files.
function browser(t, failDecode=()=>false) {
  const oldImage=Object.getOwnPropertyDescriptor(globalThis,'Image');
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const urls=new Map();
  t.mock.method(URL,'createObjectURL',file=>{const url=`blob:test-${urls.size}`;urls.set(url,file);return url;});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  class Image {
    naturalWidth=100;naturalHeight=100;
    set src(url){
      this.file=urls.get(url);
      queueMicrotask(()=>failDecode(this.file)?this.onerror():this.onload());
    }
  }
  Object.defineProperty(globalThis,'Image',{value:Image,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement(tag){
    assert.equal(tag,'canvas');
    let file;
    return {getContext:()=>({drawImage(image){file=image.file;}}),
      toBlob(callback,mime){callback(new Blob([file.name],{type:mime}));}};
  }},configurable:true});
  t.after(()=>{
    for(const [name,descriptor] of [['Image',oldImage],['document',oldDocument]]) {
      if(descriptor)Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  });
}

function backend(stage,existing=0) {
  const rows=new Map(Array.from({length:existing},(_,slot)=>[`existing-${slot}`,{id:`existing-${slot}`,slot}]));
  const stored=new Map();const attempts=[];const deleted=[];
  let reservations=0,failed=false;
  const client={from(table){
    assert.equal(table,'classified_photos');
    return {
      select(){return {eq(field,id){assert.equal(field,'listing_id');assert.equal(id,listing);
        return {order:async()=>({data:[...rows.values()],error:null})};}};},
      insert(row){
        reservations++;
        return {select(){return {single:async()=>{
          if(stage==='reservation'&&reservations===2)return {data:null,error:{message:'reserve failed'}};
          const data={...row,object_path:`${row.listing_id}/${row.id}.${row.format}`};
          rows.set(data.id,data);return {data,error:null};
        }};}};
      },
      delete(){return {eq:async(field,id)=>{
        assert.equal(field,'id');deleted.push(id);
        if(stage==='cleanup')return {error:{message:'cleanup failed'}};
        rows.delete(id);return {error:null};
      }};},
    };
  },storage:{from(bucket){
    assert.equal(bucket,'ryadom-classified-photos');
    return {upload:async(path,blob,options)=>{
      const name=await blob.text();attempts.push(name);
      assert.equal(options.upsert,false);
      assert.equal(options.contentType,'image/webp');
      assert(rows.has(path.split('/')[1].split('.')[0]),'Reservation must precede Storage upload');
      if(name==='second.jpg'&&!failed&&['upload','throw','cleanup'].includes(stage)){
        failed=true;
        if(stage==='throw')throw Error('network unavailable');
        return {error:{message:'upload failed'}};
      }
      assert(!stored.has(path),'Never overwrite a stored object');
      stored.set(path,name);return {error:null};
    }};
  }}};
  return {client,rows,stored,attempts,deleted};
}

for(const stage of ['decode','reservation','upload','throw']) {
  test(`retry after ${stage} failure uploads only the unconfirmed remainder`,async t=>{
    let decodeFailed=false;
    browser(t,file=>{
      if(stage!=='decode'||file.name!=='second.jpg'||decodeFailed)return false;
      decodeFailed=true;return true;
    });
    const state=backend(stage);
    let pending=files;
    const progress=[];
    const run=async()=>{
      const batch=pending;
      await uploadClassifiedPhotos(state.client,listing,batch,count=>{
        progress.push(count);pending=batch.slice(count);
      });
    };
    await assert.rejects(run,stage==='decode'?/браузер не открыл/:stage==='reservation'?/зарезервировать/:/загрузить фотографию/);
    assert.deepEqual(progress,[1]);
    assert.deepEqual(pending.map(file=>file.name),['second.jpg','third.jpg']);
    assert.equal(state.rows.size,1);
    assert.equal(state.stored.size,1);
    await run();
    assert.deepEqual(progress,[1,1,2]);
    assert.equal(pending.length,0);
    assert.deepEqual([...state.stored.values()],['first.jpg','second.jpg','third.jpg']);
    assert.equal(state.rows.size,3);
    assert.equal(state.attempts.filter(name=>name==='first.jpg').length,1);
    assert.deepEqual([...state.rows.values()].map(row=>row.slot),[0,1,2]);
    assert.equal(state.deleted.length,['upload','throw'].includes(stage)?1:0);
  });
}

test('cleanup failure preserves confirmed progress and reports the retained reservation',async t=>{
  browser(t);const state=backend('cleanup');const progress=[];
  await assert.rejects(uploadClassifiedPhotos(state.client,listing,files,count=>progress.push(count)),/место не удалось освободить/);
  assert.deepEqual(progress,[1]);
  assert.equal(state.rows.size,2);
  assert.equal(state.stored.size,1);
  assert.equal(state.attempts.includes('third.jpg'),false);
});

test('all successful files report progress only after Storage confirmation',async t=>{
  browser(t);const state=backend();
  await uploadClassifiedPhotos(state.client,listing,files,count=>{
    assert.equal(state.stored.size,count);
    assert.equal(state.rows.size,count);
  });
  assert.equal(state.stored.size,3);
});

test('ten-photo limit rejects oversized batches before any upload',async t=>{
  browser(t);const state=backend(undefined,9);const progress=[];
  await assert.rejects(uploadClassifiedPhotos(state.client,listing,files,count=>progress.push(count)),/10 фотографий/);
  assert.equal(state.rows.size,9);assert.equal(state.attempts.length,0);assert.deepEqual(progress,[]);
  await uploadClassifiedPhotos(state.client,listing,files.slice(0,1),count=>progress.push(count));
  assert.deepEqual(progress,[1]);assert.equal(state.rows.size,10);
});

test('failure before the first upload never advances the retry queue',async t=>{
  browser(t,()=>true);const state=backend();const progress=[];
  await assert.rejects(uploadClassifiedPhotos(state.client,listing,files,count=>progress.push(count)),/браузер не открыл/);
  assert.deepEqual(progress,[]);assert.equal(state.rows.size,0);assert.equal(state.stored.size,0);
});

test('a partial retry near capacity reuses the freed slot and reaches exactly ten photos',async t=>{
  browser(t);const state=backend('upload',8);let pending=files.slice(0,2);
  const batch=pending;
  await assert.rejects(uploadClassifiedPhotos(state.client,listing,batch,count=>{pending=batch.slice(count);}),/загрузить фотографию/);
  assert.equal(state.rows.size,9);assert.deepEqual(pending.map(file=>file.name),['second.jpg']);
  await uploadClassifiedPhotos(state.client,listing,pending);
  assert.equal(state.rows.size,10);
  assert.deepEqual([...state.stored.values()],['first.jpg','second.jpg']);
  assert.deepEqual([...state.rows.values()].map(row=>row.slot),[0,1,2,3,4,5,6,7,8,9]);
});
