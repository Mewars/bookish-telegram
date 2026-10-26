import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('residents can remove only their own comments, without resetting the anti-spam quota',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
 const as=async(role,user='')=>{await db.exec('RESET SESSION AUTHORIZATION');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET SESSION AUTHORIZATION '+role);};
 try{await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;CREATE TABLE public.community_comments(id uuid PRIMARY KEY,author_id uuid NOT NULL,status text,body text,created_at timestamptz DEFAULT now());ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.community_comments TO anon,authenticated;CREATE POLICY visible ON public.community_comments FOR SELECT USING(status='published');INSERT INTO public.community_comments(id,author_id,status,body) VALUES('${id}','${a}','published','Мой комментарий');`);
  await db.exec(await readFile('docs/sql/resident-comment-removal-v1.sql','utf8'));
  await as('anon');await assert.rejects(db.query('select public.remove_own_community_comment($1)',[id]),/permission denied/);
  await as('authenticated',b);await assert.rejects(db.query('select public.remove_own_community_comment($1)',[id]),/Not authorized/);
  await as('authenticated',a);await assert.rejects(db.query("update public.community_comments set status='archived' where id=$1",[id]),/permission denied/);await db.query('select public.remove_own_community_comment($1)',[id]);await db.query('select public.remove_own_community_comment($1)',[id]);
  await as('anon');assert.equal((await db.query('select * from public.community_comments')).rows.length,0);
  await as('postgres');const row=(await db.query('select * from public.community_comments')).rows[0];assert.equal(row.author_id,a);assert.equal(row.status,'archived');assert.equal(row.body,'[Комментарий удалён автором]');assert.equal((await db.query('select count(*)::int as count from public.community_comments where created_at>now()-interval \'1 hour\'')).rows[0].count,1);
 }finally{await db.close();}
});
