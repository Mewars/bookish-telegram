import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {hasOwnApplications} from '../src/organizations/repository.ts';

function createClient({currentUser='owner',result=[{id:'app-1'}],error=null}={}){
  const calls=[];
  const client={
    auth:{getUser:async()=>({data:{user:currentUser?{id:currentUser}:null},error:null})},
    from(table){
      calls.push(['from',table]);
      const builder={
        select(fields){calls.push(['select',fields]);return this;},
        eq(column,value){calls.push(['eq',column,value]);return this;},
        limit(count){calls.push(['limit',count]);return this;},
        abortSignal(){return Promise.resolve({data:result,error});}
      };
      return builder;
    },
  };
  return {client,calls};
}

test('guest or mismatched session never asks for applications',async()=>{
  for (const currentUser of [null,'different-user']) {
    const {client,calls}=createClient({currentUser});
    await assert.rejects(hasOwnApplications(client,'owner'),/Сессия истекла/);
    assert.equal(calls.length,0);
  }
  await assert.rejects(hasOwnApplications(null,'owner'),/не настроен/);
});
test('authenticated user sees shortcut only after submitting own application',async()=>{
  for(const [result,expected] of [[[],false],[[{id:'app-1'}],true]]){
    const {client,calls}=createClient({result});
    assert.equal(await hasOwnApplications(client,'owner'),expected);
    assert.deepEqual(calls,[
      ['from','organization_applications'],['select','id'],['eq','applicant_id','owner'],['limit',1]
    ]);
  }
});
test('failed backend does not expose a shortcut',async()=>{
  const {client}=createClient({result:null,error:{message:'offline'}});
  await assert.rejects(hasOwnApplications(client,'owner'),/Не удалось соединиться/);
});
test('profile never exposes My Applications to guests, visitors without applications, or a different session',async()=>{
  const [profile,page,sql]=await Promise.all([
    readFile('src/pages/ProfilePage.tsx','utf8'),
    readFile('src/organizations/OrganizationsPage.tsx','utf8'),
    readFile('docs/sql/organizations.sql','utf8'),
  ]);
  assert.match(profile,/const canOpenApplications = state\.status === 'authenticated' && applicationUserId === userId/);
  assert.match(profile,/openApplications && canOpenApplications && <button className="profile-row"/);
  assert.match(profile,/hasOwnApplications\(supabase, userId\)/);
  assert.match(profile,/if \(active\) setApplicationUserId\(null\)/);
  assert.match(page,/!userId \? <EmptyState title="Войдите для подачи заявки"/);
  assert.match(sql,/CREATE POLICY applications_own ON public\.organization_applications FOR SELECT TO authenticated USING \(applicant_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(sql,/REVOKE ALL ON public\.organizations, public\.organization_applications FROM PUBLIC, anon, authenticated/);
});
