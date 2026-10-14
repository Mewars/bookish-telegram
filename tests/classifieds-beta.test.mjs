import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { validateDraft } from '../src/classifieds/repository.ts';

const valid={
  city:'Енисейск',title:'Стол письменный',description:'Стол деревянный, в хорошем состоянии',
  category:'Мебель',deal_type:'sell',district:'',price_rub:null,
};
test('classified listing creation validates fields before network requests',()=>{
  assert.equal(validateDraft(valid),null);
  assert.match(validateDraft({...valid,title:'A'}),/Название/);
  assert.match(validateDraft({...valid,description:'Коротко'}),/Описание/);
  assert.match(validateDraft({...valid,price_rub:-10}),/цену/);
  assert.match(validateDraft({...valid,price_rub:Number.NaN}),/цену/);
});
test('beta is never displayed to production Supabase or public navigation',async()=>{
  const [app,route,types,header,nav,profile,sql]=await Promise.all([
    readFile('src/App.tsx','utf8'),readFile('src/hooks/useRoute.ts','utf8'),
    readFile('src/types/index.ts','utf8'),readFile('src/components/web/WebHeader.tsx','utf8'),
    readFile('src/components/Navigation.tsx','utf8'),readFile('src/pages/ProfilePage.tsx','utf8'),
    readFile('docs/sql/classifieds-private-messaging-v1.sql','utf8'),
  ]);
  assert.match(app,/VITE_CLASSIFIEDS_ENABLED === 'true'/);
  assert.match(app,/VITE_SUPABASE_URL\?\.includes\('djqhixvlfsbvannoqdjw'\)/);
  assert.match(app,/section === 'classifieds' \? classifiedsBeta/);
  assert.match(route,/'classifieds'/);
  assert.match(types,/'classifieds'/);
  assert.doesNotMatch(header,/label: 'Объявления'/);
  assert.doesNotMatch(nav,/label: 'Объявления'/);
  assert.match(profile,/openClassifieds &&|openClassifieds&&/);
  assert.match(sql,/CREATE POLICY classified_messages_participants/);
  assert.match(sql,/CREATE POLICY classifieds_author_create/);
});

test('reports and block controls stay in gated beta and use protected repository methods',async()=>{
  const [page,control,repo,sql]=await Promise.all([
    readFile('src/classifieds/ClassifiedsPage.tsx','utf8'),
    readFile('src/classifieds/ClassifiedReportControl.tsx','utf8'),
    readFile('src/classifieds/repository.ts','utf8'),
    readFile('docs/sql/classified-reports-review-v1.sql','utf8'),
  ]);
  assert.match(page,/ClassifiedReportControl/);
  assert.match(page,/setClassifiedUserBlock/);
  assert.match(page,/isBlocked\|\|!messageDraft\.trim\(\)/);
  assert.match(page,/reviewClassifiedReport/);
  assert.match(control,/submitClassifiedReport/);
  assert.match(repo,/\.rpc\('review_classified_report'/);
  assert.match(repo,/\.from\('classified_user_blocks'\)/);
  assert.match(sql,/SECURITY DEFINER SET search_path=''/);
  assert.match(sql,/v_reporter=v_actor/);
  assert.match(sql,/state='action_taken'/);
});
