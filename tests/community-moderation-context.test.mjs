import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mayModerateCommunityMaterial,pendingCommunityComments } from '../src/community/repository.ts';

test('self-moderation remains prohibited in the UI helper',()=>{
  assert.equal(mayModerateCommunityMaterial(null,'author'),false);
  assert.equal(mayModerateCommunityMaterial('author','author'),false);
  assert.equal(mayModerateCommunityMaterial('other-editor','author'),true);
});

test('pending comment context uses published RLS-visible parent in the selected city',async()=>{
  const operations=[];
  const result=[{
    id:'comment',post_id:'post',author_id:'resident',body:'Comment',status:'pending',
    created_at:'2026-10-15',community_posts:{
      city:'Енисейск',title:'Original',body:'Original text',
      post_type:'question',status:'published',
    },
  }];
  const query={
    select(fields){operations.push(['select',fields]);return this;},
    eq(key,value){operations.push(['eq',key,value]);return this;},
    order(field,settings){operations.push(['order',field,settings]);return this;},
    limit(count){operations.push(['limit',count]);return Promise.resolve({data:result,error:null});},
  };
  const client={from(table){assert.equal(table,'community_comments');return query;}};
  const output=await pendingCommunityComments(client,'Енисейск');
  assert.equal(output[0].community_posts.title,'Original');
  assert.equal(output[0].community_posts.body,'Original text');
  assert(operations.some(op=>op[0]==='select' &&
    op[1].includes('community_posts!inner(city,title,body,post_type,status)')));
  assert(operations.some(op=>op[0]==='eq' &&
    op[1]==='community_posts.city' && op[2]==='Енисейск'));
  assert(operations.some(op=>op[0]==='eq' &&
    op[1]==='community_posts.status' && op[2]==='published'));
});

test('moderation UI shows parent context and hides self-review buttons',async()=>{
  const [page,sql,app]=await Promise.all([
    readFile('src/community/CommunityPage.tsx','utf8'),
    readFile('docs/sql/community-feed-v1.sql','utf8'),
    readFile('src/App.tsx','utf8'),
  ]);
  assert.match(page,/comment\.community_posts\.title/);
  assert.match(page,/comment\.community_posts\.body/);
  assert.match(page,/community-comment-context/);
  assert.equal((page.match(/mayModerateCommunityMaterial\(userId,/g)||[]).length,2);
  assert.match(page,/Собственную публикацию должен проверить другой редактор/);
  assert.match(page,/Собственный комментарий должен проверить другой редактор/);
  assert.match(sql,/v_author=v_user/);
  assert.match(app,/VITE_COMMUNITY_ENABLED === 'true'/);
  assert.match(app,/djqhixvlfsbvannoqdjw/);
});
