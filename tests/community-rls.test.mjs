import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('community city feed enforces author, moderation, news provenance and comment privacy',async t=>{
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
    let postId,commentId;

    await t.test('resident drafts, publication cannot be self-approved or spoofed as news',async()=>{
      await switchTo('authenticated',resident);
      postId=(await db.query("SELECT public.create_community_post('Енисейск','question','Где починить велосипед?','Посоветуйте проверенную мастерскую по ремонту велосипеда') AS id")).rows[0].id;
      const draft=await db.query('SELECT id,status,author_id FROM public.community_posts WHERE id=$1',[postId]);
      assert.equal(draft.rows[0].status,'draft');
      assert.equal(draft.rows[0].author_id,resident);
      await assert.rejects(db.query("INSERT INTO public.community_posts(city,post_type,title,body) VALUES ('Енисейск','question','Прямое создание','Попытка пропустить лимиты')"),/permission denied/);
      await assert.rejects(db.query("SELECT public.create_community_post('Енисейск','news','Новость города','Редакционная публикация от пользователя')"),/Invalid community post/);
      await assert.rejects(db.query("UPDATE public.community_posts SET author_id=$1 WHERE id=$2",[editor,postId]),/permission denied/);
      await assert.rejects(db.query("UPDATE public.community_posts SET post_type='news' WHERE id=$1",[postId]),/permission denied/);
      await assert.rejects(db.query("UPDATE public.community_posts SET status='published' WHERE id=$1",[postId]),/row-level security/);
      const edited=await db.query("UPDATE public.community_posts SET title='Где отремонтировать велосипед?' WHERE id=$1 RETURNING title",[postId]);
      assert.equal(edited.rows[0].title,'Где отремонтировать велосипед?');
      await switchTo('authenticated',commenter);
      assert.equal((await db.query("UPDATE public.community_posts SET title='Чужая правка' WHERE id=$1 RETURNING id",[postId])).rows.length,0);
      await switchTo('authenticated',resident);
      await db.query("UPDATE public.community_posts SET status='pending' WHERE id=$1",[postId]);
      assert.equal((await db.query("UPDATE public.community_posts SET title='Тихая замена' WHERE id=$1 RETURNING id",[postId])).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_community_post($1,true)",[postId]),/Not authorized/);
      await assert.rejects(db.query("SELECT public.publish_city_news('Енисейск','Редакция сообщает','Редакционная новость без полномочий')"),/Not authorized/);
      await assert.rejects(db.query("SELECT public.create_community_post('Енисейск','post','x','Слишком короткая запись')"),/Invalid community post/);
    });
    await t.test('pending content is hidden from public and foreign city staff',async()=>{
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_posts')).rows.length,0);
      await assert.rejects(db.query("SELECT public.publish_city_news('Енисейск','Новость','Редакционный текст')"),/permission denied/);
      await switchTo('authenticated',commenter);
      assert.equal((await db.query('SELECT id FROM public.community_posts')).rows.length,0);
      await switchTo('authenticated',otherCityEditor);
      assert.equal((await db.query('SELECT id FROM public.community_posts')).rows.length,0);
      await assert.rejects(db.query('SELECT public.review_community_post($1,true)',[postId]),/Not authorized/);
      await switchTo('authenticated',editor);
      assert.equal((await db.query('SELECT id FROM public.community_posts')).rows.length,1);
      await db.query('SELECT public.review_community_post($1,true)',[postId]);
      await assert.rejects(db.query('SELECT public.review_community_post($1,true)',[postId]),/unavailable/);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_posts')).rows.length,1);
    });
    await t.test('private comments cannot be inserted or published by the client',async()=>{
      await switchTo('authenticated',commenter);
      commentId=(await db.query("SELECT public.submit_community_comment($1,'Спасибо, тоже интересует мастерская') AS id",[postId])).rows[0].id;
      await assert.rejects(db.query("INSERT INTO public.community_comments(post_id,body) VALUES ($1,'Прямой обход')",[postId]),/permission denied/);
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,1);
      await assert.rejects(db.query('SELECT public.review_community_comment($1,true)',[commentId]),/Not authorized/);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,0);
      await assert.rejects(db.query("SELECT public.submit_community_comment($1,'Написать без входа')",[postId]),/permission denied/);
      await switchTo('authenticated',resident);
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,0);
      await switchTo('authenticated',otherCityEditor);
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,0);
      await assert.rejects(db.query('SELECT public.review_community_comment($1,true)',[commentId]),/Not authorized/);
      await switchTo('authenticated',editor);
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,1);
      await db.query('SELECT public.review_community_comment($1,true)',[commentId]);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.community_comments')).rows.length,1);
    });
    await t.test('news are created by authorized staff only for their assigned city',async()=>{
      await switchTo('authenticated',editor);
      const newsId=(await db.query("SELECT public.publish_city_news('Енисейск','Открылась выставка','Редакционная заметка о культурном событии города') AS id")).rows[0].id;
      let news=await db.query('SELECT post_type,status,author_id FROM public.community_posts WHERE id=$1',[newsId]);
      assert.equal(news.rows[0].post_type,'news');
      assert.equal(news.rows[0].status,'published');
      assert.equal(news.rows[0].author_id,editor);
      await assert.rejects(db.query("SELECT public.publish_city_news('Лесосибирск','Чужие новости','Редакционный текст из чужого города')"),/Not authorized/);
      await switchTo('authenticated',owner);
      await db.query("SELECT public.publish_city_news('Лесосибирск','Выставка в городе','Проверенная новость города Лесосибирска')");

      await switchTo('anon');
      const feed=(await db.query("SELECT city,post_type FROM public.community_posts WHERE status='published' ORDER BY city")).rows;
      assert.equal(feed.length,3);
      assert(feed.some(x=>x.city==='Лесосибирск'&&x.post_type==='news'));
    });
    await t.test('comments cannot be added to absent or unpublished posts',async()=>{
      await switchTo('authenticated',commenter);
      await assert.rejects(db.query("SELECT public.submit_community_comment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Hello city')"),/unavailable/);
      await assert.rejects(db.query("SELECT public.submit_community_comment($1,'x')",[postId]),/Invalid comment/);
    });
    await t.test('daily resident post limit is enforced inside PostgreSQL',async()=>{
      await switchTo('authenticated',resident);
      for(let i=0;i<9;i++){
        await db.query("SELECT public.create_community_post('Енисейск','post',$1,'Проверка серверного ограничения частоты публикаций')",['Вопрос '+i+' от жителя']);
      }
      await assert.rejects(db.query("SELECT public.create_community_post('Енисейск','post','Лишняя публикация','Ещё один текст сверх дневного лимита')"),/Daily post limit reached/);
      await switchTo('authenticated',commenter);
      await db.query("SELECT public.create_community_post('Енисейск','post','Объявление для города','Лимит другого пользователя не должен блокировать меня')");
    });
    await t.test('comment creation is server rate limited',async()=>{
      await switchTo('authenticated',resident);
      for(let i=0;i<20;i++){
        await db.query("SELECT public.submit_community_comment($1,$2)",[postId,'Сообщение теста '+i]);
      }
      await assert.rejects(db.query("SELECT public.submit_community_comment($1,'Дополнительное сообщение')",[postId]),/Too many comments/);
      await switchTo('authenticated',owner);
      await db.query("SELECT public.submit_community_comment($1,'У другого пользователя собственный лимит')",[postId]);
    });
  }finally{await db.close();}
});
