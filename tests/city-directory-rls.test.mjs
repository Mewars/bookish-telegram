import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { getCityCover, winterLampsOn } from '../src/data/cityCover.ts';
import { isAvailableCity, getCityDefinition, availableCities } from '../src/data/cities.ts';
import { pageMetadata } from '../src/seo/metadata.ts';

test('city-scoped pages do not reuse Eniseysk photos or SEO text', async () => {
  assert.equal(availableCities.length, 3);
  assert.ok(isAvailableCity('Красноярск'));
  assert.equal(getCityDefinition('Красноярск')?.timeZone,'Asia/Krasnoyarsk');
  assert.ok(getCityCover('Красноярск')?.src.includes('krasnoyarsk-winter-v1'));
  assert.ok(isAvailableCity('Лесосибирск'));
  assert.equal(getCityDefinition('Лесосибирск')?.region, 'Красноярский край');
  assert.ok(getCityCover('Лесосибирск')?.src.includes('lesosibirsk-winter-v2'));
  assert.equal(getCityCover('Другой город'), null);
  assert.ok(getCityCover('Енисейск')?.src.includes('yeniseysk'));
  assert.equal(getCityCover('Другой город','http://insecure.example/city.webp'), null);
  assert.equal(getCityCover('Другой город','https://example.org/approved.webp')?.src, 'https://example.org/approved.webp');
  assert.equal(pageMetadata('home',undefined,undefined,'Лесосибирск').title,'Scarivo');
  assert.ok(pageMetadata('home',undefined,undefined,'Лесосибирск').description.includes('Лесосибирск'));
  assert.ok(!pageMetadata('home',undefined,undefined,'Лесосибирск').description.includes('Енисейск'));
  const home = await readFile('src/components/CityHome.tsx','utf8');
  const app = await readFile('src/App.tsx','utf8');
  const footer = await readFile('src/components/web/WebFooter.tsx','utf8');
  assert.match(home,/items\.filter\(item=>item\.city===city\)/);
  const editorial = await readFile('src/components/homeDiscovery.ts', 'utf8');
  assert.match(editorial,/if \(city !== 'Енисейск'\) return \[\]/);
  assert.match(home,/city-cover--no-image/);
  assert.match(home,/cityProfile\?\.summary/);
  assert.match(app,/const cityItems = currentEvents\(filterByCity\(mergeImportedEvents\(photoCatalog.items,liveEvents\), city\),eventNow\)/);
  assert.match(app,/key=\{city\}/);
  assert.match(footer,/Административная панель/);
});

test('owners alone may register cities and city covers: isolated SQL RLS', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const editor = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const assume = async (role, id='') => {
    await db.exec('RESET SESSION AUTHORIZATION; RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec('SET SESSION AUTHORIZATION '+role);
  };
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;"+
      "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);"+
      "INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');"+
      "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"+
      "GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;"+
      "GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;"+
      "CREATE TABLE public.city_admin_access(user_id uuid NOT NULL REFERENCES auth.users(id),city text NOT NULL,role text NOT NULL,active boolean NOT NULL DEFAULT true,PRIMARY KEY(user_id,city));"+
      "ALTER TABLE public.city_admin_access ENABLE ROW LEVEL SECURITY;"+
      "GRANT SELECT (user_id,city,role,active) ON public.city_admin_access TO authenticated;"+
      "CREATE POLICY read_self ON public.city_admin_access FOR SELECT TO authenticated USING (user_id=auth.uid());"+
      "INSERT INTO public.city_admin_access(user_id,city,role) VALUES ('11111111-1111-4111-8111-111111111111','*','owner'),('22222222-2222-4222-8222-222222222222','Енисейск','editor');"+
      "CREATE SCHEMA storage;"+
      "CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);"+
      "CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name));"+
      "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;"+
      "GRANT USAGE ON SCHEMA storage TO authenticated;"+
      "GRANT INSERT,SELECT,DELETE ON storage.objects TO authenticated;");
    const sql=await readFile('docs/sql/city-directory-multicity.sql','utf8');
    assert.doesNotMatch(sql,/DROP\s+TABLE|ALTER\s+TABLE\s+public\.(?:profiles|user_favorites|user_identities)/i);
    await db.exec(sql);
    await t.test('public sees cities but cannot create any',async()=>{
      await assume('anon');
      const rows=(await db.query('SELECT name,region FROM public.city_directory ORDER BY name')).rows;
      assert.deepEqual(rows.map(x=>x.name),['Енисейск','Лесосибирск']);
      await assert.rejects(db.query("INSERT INTO public.city_directory(name,region) VALUES ('Ачинск','Красноярский край')"),/permission denied/);
    });
    await t.test('stranger and franchisee cannot add/edit cities or cover objects',async()=>{
      for(const id of [editor,outsider]){
        await assume('authenticated',id);
        await assert.rejects(db.query("INSERT INTO public.city_directory(name,region) VALUES ('Ачинск','Красноярский край')"),/row-level security/);
        const edited=await db.query("UPDATE public.city_directory SET tagline='Unsafe' WHERE name='Енисейск' RETURNING name");
        assert.equal(edited.rows.length,0);
        await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-city-covers','covers/44444444-4444-4444-8444-444444444444.webp')"),/row-level security/);
      }
    });
    await t.test('verified owner can create a city and safe bucket cover only',async()=>{
      await assume('authenticated',owner);
      await db.query("INSERT INTO public.city_directory(name,region) VALUES ('Ачинск','Красноярский край')");
      await db.query("UPDATE public.city_directory SET tagline='Новый город' WHERE name='Ачинск'");
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('ryadom-city-covers','covers/44444444-4444-4444-8444-444444444444.webp')");
      await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('other','covers/55555555-5555-4555-8555-555555555555.webp')"),/row-level security/);
      await assert.rejects(db.query("INSERT INTO public.city_directory(name,region,cover_url) VALUES ('Ошибка','Красноярский край','javascript:alert(1)')"),/check constraint/);
      await assume('anon');
      assert.equal((await db.query("SELECT name FROM public.city_directory WHERE name='Ачинск'")).rows.length,1);
    });
  } finally {await db.close();}
});

// The schedule uses city time even when the visitor's device is elsewhere.
for (const [instant,on] of [
 ['2026-11-01T01:59:59Z',true], ['2026-11-01T02:00:00Z',false],
 ['2026-11-01T11:59:59Z',false], ['2026-11-01T12:00:00Z',true],
 ['2026-11-01T17:00:00Z',true],
]) {
 const now=new Date(instant);
 assert.equal(winterLampsOn(now),on,instant);
 assert.equal(getCityCover('Енисейск',null,now).src.includes('churches-off'),!on);
 assert.equal(getCityCover('Лесосибирск',null,now).src.endsWith(on?'v2-on.webp':'v2-off.webp'),true);
 assert.equal(getCityCover('Красноярск',null,now).src.endsWith(on?'v1-on.webp':'v1-off.webp'),true);
 assert.equal(getCityCover('Другой город',null,now),null);
}

// Hands include minute/second offsets, rather than a decorative fixed time.
const {winterTime}=await import('../src/home/winterTime.ts');
const t=winterTime(new Date('2026-11-01T05:30:30Z'));
assert.equal(t.label,'12:30:30');
assert.equal(t.hourAngle,15.25);
assert.equal(t.minuteAngle,183);
assert.equal(t.secondAngle,180);
