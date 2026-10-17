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
  const foreignEditor='66666666-6666-4666-8666-666666666666';
  const switchTo=async(name,id='')=>{
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec('SET SESSION AUTHORIZATION '+name);
  };
  const makeDraft=city=>db.query(
    "INSERT INTO public.classifieds(city,deal_type,category,title,description,price_rub) VALUES ($1,'sell','Для дома','Стол письменный','Стол из дерева, хорошее состояние',2500) RETURNING id,status",[city]);
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);");
    await db.query("INSERT INTO auth.users(id) VALUES ($1),($2),($3),($4),($5),($6)",[seller,buyer,stranger,editor,owner,foreignEditor]);
    await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;");
    await db.exec("CREATE TABLE public.city_directory(name text PRIMARY KEY,active boolean NOT NULL DEFAULT true); INSERT INTO public.city_directory(name) VALUES ('Енисейск'),('Лесосибирск'); GRANT SELECT ON public.city_directory TO anon,authenticated;");
    await db.exec("CREATE TABLE public.city_admin_access(user_id uuid REFERENCES auth.users(id),city text,role text,active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city)); GRANT SELECT ON public.city_admin_access TO authenticated;");
    await db.query("INSERT INTO public.city_admin_access(user_id,city,role) VALUES ($1,'*','owner'),($2,'Енисейск','editor'),($3,'Лесосибирск','editor')",[owner,editor,foreignEditor]);
    await db.exec(await readFile('docs/sql/classifieds-private-messaging-v1.sql','utf8'));
    await db.exec(await readFile('docs/sql/classified-unread-receipts-v1.sql','utf8'));
    await db.exec(await readFile('docs/sql/classifieds-editor-privacy-v2.sql','utf8'));
    await db.exec(await readFile('docs/sql/classified-reports-review-v1.sql','utf8'));
    await db.exec(await readFile('docs/sql/classified-owner-archive-v1.sql','utf8'));
    await db.exec(await readFile('docs/sql/classified-rejection-reasons-v1.sql','utf8'));

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
      assert.equal((await db.query('SELECT id,status FROM public.classifieds')).rows.length,0);
      await assert.rejects(db.query('SELECT * FROM public.classified_messages'),/permission denied/);
      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT id,status FROM public.classifieds')).rows.length,0);
      await assert.rejects(db.query("SELECT public.open_classified_conversation($1)",[id]),/unavailable/);
      await switchTo('authenticated',editor);
      // Editors must not see a resident's unsubmitted draft.
      assert.equal((await db.query('SELECT id,status FROM public.classifieds')).rows.length,1);
      await db.query("SELECT public.review_classified($1,true)",[id]);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id,status FROM public.classifieds')).rows.length,1);
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
    await t.test('unread receipts belong to each participant and cannot be forged',async()=>{
      await switchTo('authenticated',seller);
      const ownUnread=(await db.query(
        'SELECT conversation_id,unread_count FROM public.get_classified_unread_counts()'
      )).rows;
      assert.equal(ownUnread.length,1);
      assert.equal(ownUnread[0].conversation_id,thread);
      assert.equal(Number(ownUnread[0].unread_count),2,'Buyer has sent two messages');
      const buyerMessages=(await db.query(
        'SELECT id FROM public.classified_messages WHERE sender_id=$1 ORDER BY created_at DESC,id DESC',[buyer]
      )).rows;
      const latestBuyerMessage=buyerMessages[0].id;
      await db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,latestBuyerMessage]);
      assert.equal((await db.query('SELECT count(*)::int as amount FROM public.get_classified_unread_counts()')).rows[0].amount,0);
      // A stale client cannot move the receipt backwards.
      await db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,buyerMessages.at(-1).id]);
      assert.equal((await db.query('SELECT count(*)::int as amount FROM public.get_classified_unread_counts()')).rows[0].amount,0);
      await assert.rejects(
        db.query("INSERT INTO public.classified_conversation_reads(conversation_id,user_id,last_read_at,last_read_id) VALUES ($1,$2,now(),$3)",[thread,seller,latestBuyerMessage]),
        /permission denied/,
      );

      await switchTo('authenticated',buyer);
      const buyerUnread=(await db.query('SELECT unread_count FROM public.get_classified_unread_counts()')).rows;
      assert.equal(buyerUnread.length,1);
      assert.equal(Number(buyerUnread[0].unread_count),1,'Outgoing buyer messages never counted');
      assert.equal((await db.query('SELECT * FROM public.classified_conversation_reads')).rows.length,0,
        'Seller receipt is not visible to buyer');
      await assert.rejects(
        db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']),
        /Message unavailable/,
      );
      const sellerReply=(await db.query(
        'SELECT id FROM public.classified_messages WHERE sender_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[seller]
      )).rows[0].id;
      await db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,sellerReply]);
      assert.equal((await db.query('SELECT count(*)::int as amount FROM public.get_classified_unread_counts()')).rows[0].amount,0);
      assert.equal((await db.query('SELECT * FROM public.classified_conversation_reads')).rows.length,1,
        'Buyer may only inspect their own receipt');

      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT * FROM public.get_classified_unread_counts()')).rows.length,0);
      assert.equal((await db.query('SELECT * FROM public.classified_conversation_reads')).rows.length,0);
      await assert.rejects(
        db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,latestBuyerMessage]),
        /Conversation unavailable/,
      );

      await switchTo('anon');
      await assert.rejects(db.query('SELECT * FROM public.get_classified_unread_counts()'),/permission denied/);
      await assert.rejects(
        db.query('SELECT public.mark_classified_messages_read($1,$2)',[thread,latestBuyerMessage]),
        /permission denied/,
      );
      await assert.rejects(db.query('SELECT * FROM public.classified_conversation_reads'),/permission denied/);
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

    await t.test('only a listing owner may archive a published listing',async()=>{
      await switchTo('authenticated',seller);
      const archivedId=(await makeDraft('Енисейск')).rows[0].id;
      await assert.rejects(db.query('SELECT public.archive_classified($1)',[archivedId]),/unavailable/);
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[archivedId]);
      await switchTo('authenticated',editor);
      await db.query('SELECT public.review_classified($1,true)',[archivedId]);
      await switchTo('authenticated',buyer);
      const archivedThread=(await db.query('SELECT public.open_classified_conversation($1) AS id',[archivedId])).rows[0].id;
      await db.query('SELECT public.send_classified_message($1,$2)',[archivedThread,'Первое сообщение']);
      await assert.rejects(db.query('SELECT public.archive_classified($1)',[archivedId]),/unavailable/);
      await switchTo('authenticated',owner);
      await assert.rejects(db.query('SELECT public.archive_classified($1)',[archivedId]),/unavailable/);
      await switchTo('anon');
      await assert.rejects(db.query('SELECT public.archive_classified($1)',[archivedId]),/permission denied/);
      await switchTo('authenticated',seller);
      await db.query('SELECT public.archive_classified($1)',[archivedId]);
      assert.equal((await db.query('SELECT status FROM public.classifieds WHERE id=$1',[archivedId])).rows[0].status,'archived');
      await assert.rejects(db.query('SELECT public.archive_classified($1)',[archivedId]),/unavailable/);
      await switchTo('anon');
      assert.equal((await db.query('SELECT id FROM public.classifieds WHERE id=$1',[archivedId])).rows.length,0);
      await switchTo('authenticated',buyer);
      assert.equal((await db.query('SELECT id FROM public.classifieds WHERE id=$1',[archivedId])).rows.length,0);
      await assert.rejects(db.query('SELECT public.open_classified_conversation($1)',[archivedId]),/unavailable/);
      await assert.rejects(db.query('SELECT public.send_classified_message($1,$2)',[archivedThread,'Позднее сообщение']),/unavailable/);
      await switchTo('authenticated',seller);
      await db.query('SELECT public.archive_classified($1)',[id]);
      assert.equal((await db.query('SELECT status FROM public.classifieds WHERE id=$1',[id])).rows[0].status,'archived',
        'Owner may also archive a completed listing');
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
      await assert.rejects(db.query("INSERT INTO public.classified_reports(listing_id,reason) VALUES ($1,'Попытка пожаловаться на собственное объявление')",[reportListing]),/row-level security/);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,true)",[complaint]),/Not authorized/);

      await switchTo('authenticated',stranger);
      assert.equal((await db.query('SELECT id FROM public.classified_reports')).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,true)",[complaint]),/Not authorized/);

      await switchTo('authenticated',foreignEditor);
      assert.equal((await db.query('SELECT id FROM public.classified_reports')).rows.length,0);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,true)",[complaint]),/Not authorized/);

      await switchTo('authenticated',stranger);
      const otherComplaint=(await db.query("INSERT INTO public.classified_reports(listing_id,reason) VALUES ($1,'Подозрение на поддельную информацию в объявлении') RETURNING id",[reportListing])).rows[0].id;

      await switchTo('authenticated',editor);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'open');
      await db.query("SELECT public.review_classified_report($1,true)",[complaint]);
      await assert.rejects(db.query("SELECT public.review_classified_report($1,false)",[complaint]),/unavailable/);
      // The archived listing is no longer part of the editor's public listing view;
      // the original reporter retains their own resolution status.
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'action_taken');
      await switchTo('authenticated',stranger);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[otherComplaint])).rows[0].state,'action_taken');

      await switchTo('anon');
      assert.equal((await db.query("SELECT id FROM public.classifieds WHERE id=$1",[reportListing])).rows.length,0);
      await assert.rejects(db.query("SELECT id FROM public.classified_reports"),/permission denied/);
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("SELECT state FROM public.classified_reports WHERE id=$1",[complaint])).rows[0].state,'action_taken');
    });
    await t.test('author may correct rejected drafts, but cannot edit pending or published listings',async()=>{
      await switchTo('authenticated',seller);
      const draftId=(await makeDraft('Енисейск')).rows[0].id;
      const first=(await db.query(
        "UPDATE public.classifieds SET title='Стол после правки',description='Письменный стол, небольшие царапины',price_rub=1900,category='Мебель',district='Центр' WHERE id=$1 RETURNING title,price_rub,status",
        [draftId],
      )).rows[0];
      assert.equal(first.title,'Стол после правки');
      assert.equal(Number(first.price_rub),1900);
      assert.equal(first.status,'draft');
      await assert.rejects(db.query("UPDATE public.classifieds SET city='Лесосибирск' WHERE id=$1",[draftId]),/permission denied/);
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("UPDATE public.classifieds SET title='Чужое объявление' WHERE id=$1 RETURNING id",[draftId])).rows.length,0);
      await switchTo('authenticated',seller);
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[draftId]);
      assert.equal((await db.query("UPDATE public.classifieds SET title='Правка после отправки' WHERE id=$1 RETURNING id",[draftId])).rows.length,0);
      await switchTo('authenticated',editor);
      await assert.rejects(db.query("SELECT public.review_classified($1,false)",[draftId]),/Rejection reason required/);
      await assert.rejects(db.query("SELECT public.review_classified_with_reason($1,false,$2)",[draftId,'bad']),/Rejection reason/);
      await switchTo('authenticated',foreignEditor);
      await assert.rejects(db.query("SELECT public.review_classified_with_reason($1,false,$2)",[draftId,'Уточните описание товара для публикации.']),/Not authorized/);
      await switchTo('authenticated',seller);
      await assert.rejects(db.query("SELECT public.review_classified_with_reason($1,false,$2)",[draftId,'Уточните описание товара для публикации.']),/Not authorized/);
      await switchTo('authenticated',editor);
      await db.query("SELECT public.review_classified_with_reason($1,false,$2)",[draftId,'Уточните описание товара для публикации.']);
      await switchTo('authenticated',seller);
      const rejection=(await db.query("SELECT status,rejection_reason FROM public.classifieds WHERE id=$1",[draftId])).rows[0];
      assert.equal(rejection.status,'rejected');
      assert.equal(rejection.rejection_reason,'Уточните описание товара для публикации.');
      assert.equal((await db.query("SELECT decision,reason FROM public.classified_moderation_history WHERE listing_id=$1",[draftId])).rows[0].decision,'rejected');
      await switchTo('authenticated',buyer);
      assert.equal((await db.query("SELECT id FROM public.classified_moderation_history WHERE listing_id=$1",[draftId])).rows.length,0);
      await assert.rejects(db.query("UPDATE public.classified_moderation_history SET reason='подмена' WHERE listing_id=$1",[draftId]),/permission denied/);
      await switchTo('anon');
      await assert.rejects(db.query("SELECT rejection_reason FROM public.classifieds WHERE id=$1",[draftId]),/permission denied/);
      await switchTo('authenticated',seller);
      const corrected=(await db.query(
        "UPDATE public.classifieds SET title='Стол после замечаний',description='Исправленное описание письменного стола',status='draft' WHERE id=$1 RETURNING title,status",
        [draftId],
      )).rows[0];
      assert.equal(corrected.title,'Стол после замечаний');
      assert.equal(corrected.status,'draft');
      assert.equal((await db.query("SELECT rejection_reason FROM public.classifieds WHERE id=$1",[draftId])).rows[0].rejection_reason,null,
        'Resubmitting must clear active rejection reason, preserving historical event');
      await db.query("UPDATE public.classifieds SET status='pending' WHERE id=$1",[draftId]);
      await switchTo('authenticated',editor);
      await db.query("SELECT public.review_classified($1,true)",[draftId]);
      await switchTo('authenticated',seller);
      assert.equal((await db.query("UPDATE public.classifieds SET title='Обход после публикации' WHERE id=$1 RETURNING id",[draftId])).rows.length,0);
    });
  } finally {await db.close();}
});
