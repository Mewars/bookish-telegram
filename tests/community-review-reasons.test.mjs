import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('wall rejection reasons stay private and resident submissions require moderation',async t=>{
  const db=new PGlite();
  const resident='11111111-1111-4111-8111-111111111111';
  const commenter='22222222-2222-4222-8222-222222222222';
  const editor='33333333-3333-4333-8333-333333333333';
  const otherCityEditor='44444444-4444-4444-8444-444444444444';
  const owner='55555555-5555-4555-8555-555555555555';
  const switchTo=async(role,user='')=>{
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);
    await db.exec('SET SESSION AUTHORIZATION '+role);
  };
  try{
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);");
    await db.query("INSERT INTO auth.users(id) VALUES ($1),($2),($3),($4),($5)",[resident,commenter,editor,otherCityEditor,owner]);
    await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;");
    await db.exec("CREATE TABLE public.city_directory(name text PRIMARY KEY,active boolean NOT NULL DEFAULT true); INSERT INTO public.city_directory(name) VALUES ('Енисейск'),('Лесосибирск'); GRANT SELECT ON public.city_directory TO anon,authenticated; CREATE TABLE public.city_admin_access(user_id uuid REFERENCES auth.users(id),city text,role text,active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city)); GRANT SELECT ON public.city_admin_access TO authenticated;");
    await db.query("INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,'Енисейск','editor'),($2,'Лесосибирск','editor'),($3,'*','owner')",[editor,otherCityEditor,owner]);
    const ddl=await readFile('docs/sql/community-feed-v1.sql','utf8');
    await db.exec(ddl);
    await db.exec(await readFile('docs/sql/community-post-archive-v1.sql','utf8'));

    await db.exec(await readFile('docs/sql/community-review-reasons-v1.sql','utf8'));
    await db.exec("INSERT INTO public.city_directory(name) VALUES ('Новый город')");
    let postId;
    const reasonRows=()=>db.query('SELECT post_id,reason,reviewed_at FROM public.community_post_review_reasons');
    await t.test('resident submits to pending and cannot approve or set their own rejection reason',async()=>{
      await switchTo('authenticated',resident);
      postId=(await db.query("SELECT public.create_community_post('Енисейск','post','Вопрос жителей','Подскажите проверенную городскую мастерскую') AS id")).rows[0].id;
      assert.equal((await db.query('SELECT public.community_submit_post($1) AS status',[postId])).rows[0].status,'pending');
      await assert.rejects(db.query('SELECT public.review_community_post_with_reason($1,true,NULL)',[postId]),/Not authorized/);
      await assert.rejects(db.query("INSERT INTO public.community_post_review_reasons(post_id,reason,reviewed_by) VALUES ($1,'Сам себе отказ',$2)",[postId,resident]),/permission denied/);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_posts WHERE id=$1',[postId])).rows.length,0);
      await assert.rejects(reasonRows(),/permission denied/);
      await assert.rejects(db.query("SELECT public.review_community_post_with_reason($1,false,'Причина отказа')",[postId]),/permission denied/);
    });
    await t.test('foreign city editor cannot review; same-city editor must give a valid reason',async()=>{
      await switchTo('authenticated',otherCityEditor);
      await assert.rejects(db.query("SELECT public.review_community_post_with_reason($1,false,'Уточните описание')",[postId]),/Not authorized/);
      await switchTo('authenticated',editor);
      for(const value of [null,'  ','ab','x'.repeat(1001)]){
        await assert.rejects(db.query('SELECT public.review_community_post_with_reason($1,false,$2)',[postId,value]),/Rejection reason required/);
      }
      await assert.rejects(db.query('SELECT public.review_community_post($1,false)',[postId]),/Rejection reason required/);
      assert.equal((await db.query('SELECT status FROM public.community_posts WHERE id=$1',[postId])).rows[0].status,'pending');
      await db.query("SELECT public.review_community_post_with_reason($1,false,'  Добавьте подробности  ')",[postId]);
    });
    await t.test('reason is visible to author and global owner, hidden from other residents and foreign staff',async()=>{
      await switchTo('authenticated',resident);
      assert.equal((await reasonRows()).rows[0].reason,'Добавьте подробности');
      await assert.rejects(db.query("UPDATE public.community_post_review_reasons SET reason='Подмена' WHERE post_id=$1",[postId]),/permission denied/);
      await assert.rejects(db.query('SELECT reviewed_by FROM public.community_post_review_reasons'),/permission denied/);
      await switchTo('authenticated',commenter);
      assert.equal((await reasonRows()).rows.length,0);
      await switchTo('authenticated',otherCityEditor);
      assert.equal((await reasonRows()).rows.length,0);
      await switchTo('authenticated',owner);
      assert.equal((await reasonRows()).rows.length,1);
    });
    await t.test('author corrects rejected post, resubmits, and approved post becomes public without the old reason',async()=>{
      await switchTo('authenticated',resident);
      await db.query("UPDATE public.community_posts SET title='Уточнённый вопрос жителей',body='Подробный текст для повторной проверки',status='draft' WHERE id=$1",[postId]);
      await db.query('SELECT public.community_submit_post($1)',[postId]);
      assert.equal((await db.query("UPDATE public.community_posts SET status='published' WHERE id=$1 RETURNING id",[postId])).rows.length,0);
      assert.equal((await db.query('SELECT status FROM public.community_posts WHERE id=$1',[postId])).rows[0].status,'pending');
      await switchTo('authenticated',owner);
      await db.query('SELECT public.review_community_post_with_reason($1,true,NULL)',[postId]);
      assert.equal((await reasonRows()).rows.length,0);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_posts WHERE id=$1',[postId])).rows.length,1);
    });
    await t.test('future cities use review; global owner may review own post, city editor cannot',async()=>{
      await switchTo('authenticated',owner);
      const id=(await db.query("SELECT public.create_community_post('Новый город','post','Запись владельца','Текст записи в новом подключённом городе') AS id")).rows[0].id;
      assert.equal((await db.query('SELECT public.community_submit_post($1) AS status',[id])).rows[0].status,'pending');
      await db.query('SELECT public.review_community_post_with_reason($1,true,NULL)',[id]);
      await switchTo('authenticated',editor);
      const own=(await db.query("SELECT public.create_community_post('Енисейск','post','Запись редактора','Текст редактора требует проверки другого модератора') AS id")).rows[0].id;
      await db.query('SELECT public.community_submit_post($1)',[own]);
      await assert.rejects(db.query('SELECT public.review_community_post_with_reason($1,true,NULL)',[own]),/Not authorized/);
    });
  }finally{await db.close();}
});
