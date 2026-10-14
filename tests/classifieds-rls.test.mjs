import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('classifieds enforce ownership, moderation, and private messaging in PostgreSQL', async t => {
  const db = new PGlite();
  const seller='11111111-1111-4111-8111-111111111111';
  const buyer='22222222-2222-4222-8222-222222222222';
  const stranger='33333333-3333-4333-8333-333333333333';
  const editor='44444444-4444-4444-8444-444444444444';
  const owner='55555555-5555-4555-8555-555555555555';
  const switchTo=async(name,id='')=>{
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec('SET SESSION AUTHORIZATION '+name);
  };
  const makeDraft=city=>db.query(
    "INSERT INTO public.classifieds(city,deal_type,category,title,description,price_rub) VALUES ($1,'sell','Для дома','Стол письменный','Стол из дерева, хорошее состояние',2500) RETURNING id,status",[city]);
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);");
    await db.query("INSERT INTO auth.users(id) VALUES ($1),($2),($3),($4),($5)",[seller,buyer,stranger,editor,owner]);
    await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;");
    await db.exec("CREATE TABLE public.city_directory(name text PRIMARY KEY,active boolean NOT NULL DEFAULT true); INSERT INTO public.city_directory(name) VALUES ('Енисейск'),('Лесосибирск'); GRANT SELECT ON public.city_directory TO anon,authenticated;");
    await db.exec("CREATE TABLE public.city_admin_access(user_id uuid REFERENCES auth.users(id),city text,role text,active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city)); GRANT SELECT ON public.city_admin_access TO authenticated;");
    await db.query("INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,'*','owner'),($2,'Енисейск','editor')",[owner,editor]);
    await db.exec(await readFile('docs/sql/classifieds-private-messaging-v1.sql','utf8'));
    await db.exec(await readFile('docs/sql/classifieds-editor-privacy-v2.sql','utf8'));
    await db.exec(await readFile('docs/sql/classified-reports-review-v1.sql','utf8'));

    let id,thread;
    await t.test('draft and moderation: no author self-publishing',async()=>{
      await switchTo('authenticated',seller);
      const made=await makeDraft('Енисейск'); id=made.rows[0].id;
      assert.equal(made.rows[0].status,'draft');
      await switchTo('authenticated',editor);
      assert.equal((await db.query('SELECT id FROM public.classifieds')).rows.length,0,'Editor cannot read private draft');
      await switchTo('authenticated',seller);
      await assert.rejects(db.query("INSERT INTO public.classifieds(city,deal_type,category,title,description,author_id) VALUES ('Енисейск','sell','Дом','Отдам диван','Есть готовый диван',$1)",[buyer]),/permission denied/);
      await assert.rejects(db.query("UPDATE public.classifieds SET author_id=$1 WHERE id=$2",[buyer,id]),/permission denied/);
      await assert.rejects(db.query("UPDATE public.classifieds SET status='published' WHERE id=$1 RETURNING id",[id]),/row-level security/);
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[id]);
      assert.equal((await db.query("UPDATE public.classifieds SET title='Подмена' WHERE id=$1 RETURNING id",[id])).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_classified($1,true)",[id]),/Not authorized/);
    });
    await t.test('guest, outsider and foreign editor cannot see or publish drafts',async()=>{
      await switchTo('anon');
      assert.equal((await db.query('SELECT * FROM public.classifieds')).rows.length,0);
      await assert.rejects(db.query('SELECT * FROM public.classified_messages'),/permission denied/);
      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT * FROM public.classifieds')).rows.length,0);
      await assert.rejects(db.query("SELECT public.open_classified_conversation($1)",[id]),/unavailable/);
      await switchTo('authenticated',editor);
      // Editors must not see a resident's unsubmitted draft.
      assert.equal((await db.query('SELECT * FROM public.classifieds')).rows.length,1);
      await db.query("SELECT public.review_classified($1,true)",[id]);
      await switchTo('anon');
      assert.equal((await db.query('SELECT * FROM public.classifieds')).rows.length,1);
    });
    await t.test('buyer can open and send; outsider cannot read or spoof identities',async()=>{
      await switchTo('authenticated',buyer);
      thread=(await db.query("SELECT public.open_classified_conversation($1) AS id",[id])).rows[0].id;
      assert.equal((await db.query("SELECT public.open_classified_conversation($1) AS id",[id])).rows[0].id,thread);
      await assert.rejects(db.query("INSERT INTO public.classified_conversations(listing_id,buyer_id,seller_id) VALUES ($1,$2,$3)",[id,stranger,seller]),/permission denied/);
      await db.query("SELECT public.send_classified_message($1,'Здравствуйте!')",[thread]);
      await assert.rejects(db.query("INSERT INTO public.classified_messages(conversation_id,sender_id,body) VALUES ($1,$2,'От чужого лица')",[thread,seller]),/permission denied/);
      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT * FROM public.classified_conversations')).rows.length,0);
      assert.equal((await db.query('SELECT * FROM public.classified_messages')).rows.length,0);
      await assert.rejects(db.query("SELECT public.send_classified_message($1,'Спам')",[thread]),/unavailable/);
      await switchTo('authenticated',seller);
      assert.equal((await db.query('SELECT * FROM public.classified_messages')).rows.length,1);
      await db.query("SELECT public.send_classified_message($1,'Да, стол есть')",[thread]);
    });
    await t.test('block prevents messages, and private block list remains hidden',async()=>{
      await switchTo('authenticated',buyer);
      await db.query("INSERT INTO public.classified_user_blocks(blocker_id,blocked_id) VALUES ($1,$2)",[buyer,seller]);
      await assert.rejects(db.query("SELECT public.send_classified_message($1,'Проверка')",[thread]),/blocked/);
      await switchTo('authenticated',seller);
      assert.equal((await db.query('SELECT * FROM public.classified_user_blocks')).rows.length,0);
      await assert.rejects(db.query("SELECT public.send_classified_message($1,'Проверка')",[thread]),/blocked/);
      await switchTo('authenticated',buyer);
      await db.query("DELETE FROM public.classified_user_blocks WHERE blocked_id=$1",[seller]);
      await db.query("SELECT public.send_classified_message($1,'Разблокирован')",[thread]);
    });
    await t.test('moderation stays limited to assigned city; seller may close listing',async()=>{
      await switchTo('authenticated',seller);
      const another=(await makeDraft('Лесосибирск')).rows[0].id;
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[another]);
      await switchTo('authenticated',editor);
      await assert.rejects(db.query("SELECT public.review_classified($1,true)",[another]),/Not authorized/);
      await switchTo('authenticated',owner);
      await db.query("SELECT public.review_classified($1,true)",[another]);
      await switchTo('authenticated',seller);
      await db.query("SELECT public.complete_classified($1)",[id]);
      assert.equal((await db.query("SELECT status FROM public.classifieds WHERE id=$1",[id])).rows[0].status,'completed');
    });

    await t.test('report visibility, city moderation, and archived content',async()=>{
      await switchTo('authenticated',seller);
      const reportListing=(await makeDraft('Енисейск')).rows[0].id;
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[reportListing]);
      await switchTo('authenticated',editor);
      await db.query("SELECT public.review_classified($1,true)",[reportListing]);
      await switchTo('authenticated',buyer);
      const complaint=(await db.query("INSERT INTO public.classified_reports(listing_id,reason) VALUES ($1,'В объявлении недостоверные сведения') RETURNING id",[reportListing])).rows[0].id;
      await assert.rejects(db.query("INSERT INTO public.classified_reports(listing_id,reason) VALUES ($1,'Повторная жалоба на то же объявление')",[reportListing]),/duplicate key/);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'open');

      await switchTo('authenticated',seller);
      assert.equal((await db.query('SELECT id FROM public.classified_reports')).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,true)",[complaint]),/Not authorized/);

      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT id FROM public.classified_reports')).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,true)",[complaint]),/Not authorized/);

      await switchTo('authenticated',editor);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'open');
      await db.query("SELECT public.review_classified_report($1,true)",[complaint]);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,false)",[complaint]),/unavailable/);
      // The archived listing is no longer part of the editor's public listing view;
      // the original reporter retains their own resolution status.
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'action_taken');

      await switchTo('anon');
      assert.equal((await db.query("SELECT id FROM public.classifieds WHERE id=$1",[reportListing])).rows.length,0);
      await assert.rejects(db.query("SELECT id FROM public.classified_reports"),/permission denied/);
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'action_taken');
    });
  } finally {await db.close();}
});
