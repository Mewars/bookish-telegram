import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { archiveCommunityPost,validatePost,validateComment,postTypeNames } from '../src/community/repository.ts';

test('community drafts and comments are validated before making network calls',()=>{
  assert.equal(validatePost('Вопрос соседям','Подскажите хорошую мастерскую'),null);
  assert.match(validatePost('x','Достаточно длинный текст'),/Название/);
  assert.match(validatePost('Нормальное название','Коротко'),/Текст/);
  assert.match(validateComment('x'),/Комментарий/);
  assert.equal(validateComment('Спасибо, помогли!'),null);
  assert.equal(postTypeNames.news,'Новости редакции');
});
test('author withdrawal calls server RPC and never accepts an author ID',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return {error:null};}};
  await archiveCommunityPost(client,'example-post');
  assert.deepEqual(calls,[{name:'archive_community_post',args:{p_id:'example-post'}}]);
  await assert.rejects(archiveCommunityPost({rpc:async()=>({error:{message:'Denied'}})},'post'),/Не удалось выполнить действие/);
});
test('community route is disabled without explicit test Supabase config',async()=>{
  const [app,route,types,header,mobile,profile,sql,ui]=await Promise.all([
    readFile('src/App.tsx','utf8'),
    readFile('src/hooks/useRoute.ts','utf8'),
    readFile('src/types/index.ts','utf8'),
    readFile('src/components/web/WebHeader.tsx','utf8'),
    readFile('src/components/Navigation.tsx','utf8'),
    readFile('src/pages/ProfilePage.tsx','utf8'),
    readFile('docs/sql/community-feed-v1.sql','utf8'),
    readFile('src/community/CommunityPage.tsx','utf8'),
  ]);
  assert.match(app,/VITE_COMMUNITY_ENABLED === 'true'/);
  assert.match(app,/isRyadomTestBackend\(import\.meta\.env\.VITE_SUPABASE_URL\)/);
  assert.doesNotMatch(app,/VITE_SUPABASE_URL\?\.includes\(/);
  assert.match(app,/section === 'community' \? communityBeta/);
  assert.match(route,/'community'/);
  assert.match(types,/'community'/);
  assert.doesNotMatch(header,/label: 'Новости'/);
  assert.doesNotMatch(mobile,/label: 'Новости'/);
  assert.match(profile,/openCommunity&&/);
  assert.match(sql,/CREATE POLICY community_comments_public_read/);
  assert.match(sql,/CREATE FUNCTION public.review_community_comment/);
  assert.match(sql,/CREATE FUNCTION public.create_community_post/);
  assert.match(ui,/\bCommunityPage\b/);
  assert.match(ui,/Отправить на проверку/);
  assert.match(ui,/Комментарии/);
  assert.match(ui,/updateCommunityDraft/);
  assert.match(ui,/Редактирование черновика/);
  assert.match(ui,/Сохранить изменения/);
  assert.match(ui,/archiveCommunityPost/);
  assert.match(ui,/Скрыть публикацию/);
  assert.match(ui,/Вернуть её самостоятельно нельзя/);
});
