"""Standalone production UI against disposable real Auth/PostgREST/Storage.

The production origin in the unchanged application is a virtual test address:
every request to it is fulfilled from loopback. No hosted project is contacted.
"""
import argparse, base64, json, re, sys, traceback, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--workdir',required=True,type=Path)
args=parser.parse_args()
cfg=json.loads((args.workdir/'credentials.json').read_text())
origin='http://127.0.0.1:4180'
virtual='cptbmepnbzogqkfhflsg.supabase.co'
sessions={}
results=[]
def safe_error(kind,error,tb):
 text=''.join(traceback.format_exception(kind,error,tb))
 for value in [cfg['jwt_secret'],cfg['db_password'],cfg['service_key'],cfg['anon_key']]+[u['password'] for u in cfg['users'].values()]:
  text=text.replace(value,'[redacted]')
 sys.stderr.write(re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[redacted JWT]',text))
sys.excepthook=safe_error
def api(role,method,path,data=None):
 request=urllib.request.Request(origin+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={
  'Authorization':'Bearer '+sessions.get(role,{}).get('access_token',cfg['anon_key']),
  'apikey':cfg['anon_key'],'Content-Type':'application/json','Prefer':'return=representation'})
 try:response=urllib.request.urlopen(request,timeout=15)
 except urllib.error.HTTPError as error:response=error
 raw=response.read()
 try:body=json.loads(raw)
 except ValueError:body=None
 return response.status,body
def passed(message):
 results.append(message);print('PASS host real backend:',message,flush=True)
def records(role,table,title):
 from urllib.parse import urlencode
 code,rows=api(role,'GET','/rest/v1/'+table+'?'+urlencode({'select':'id,status,city','title':'eq.'+title}))
 assert code==200,(table,code)
 return rows
def rpc(role,name,values,expected=200):
 code,data=api(role,'POST','/rest/v1/rpc/'+name,values)
 assert code==expected or (expected==200 and code==204),(name,role,code,data)
 return data
for role,user in cfg['users'].items():
 code,data=api(None,'POST','/auth/v1/token?grant_type=password',{'email':user['email'],'password':user['password']})
 assert code==200,'Local Auth sign-in failed: '+role
 sessions[role]=data

with sync_playwright() as p:
 browser=p.chromium.launch()
 contexts=[]
 def new_page(role,width=390):
  context=browser.new_context(viewport={'width':width,'height':900})
  contexts.append(context)
  if role:
   session=json.dumps(sessions[role])
   context.add_init_script("localStorage.setItem('sb-cptbmepnbzogqkfhflsg-auth-token',"+json.dumps(session)+")")
  def route(request):
   parsed=urlsplit(request.request.url)
   if parsed.hostname==virtual:
    response=request.fetch(url=origin+parsed.path+('?' + parsed.query if parsed.query else ''))
    request.fulfill(response=response)
   elif parsed.netloc=='127.0.0.1:4180':
    if parsed.path.startswith('/notifications/'):
     request.fulfill(status=200,content_type='text/javascript',body='')
    else:request.continue_()
   else:request.abort()
  context.route('**/*',route)
  return context.new_page()
 guest=new_page(None)
 resident=new_page('seller')
 editor=new_page('editor',1440)
 owner=new_page('owner',1440)
 foreign=new_page('foreign_editor')
 # Both failures occur after INSERT has committed. Retrying must reuse its ID.
 for module,table,rpc_name in [('classifieds','classifieds',None),('wall','community_posts','community_submit_post')]:
  title='Проверка повторной отправки '+module
  resident.goto(origin+'/host/'+module+'/')
  if module=='classifieds':
   resident.get_by_role('button',name='Подать объявление',exact=True).click()
   resident.locator('input[name="title"]').fill(title)
   resident.locator('textarea[name="description"]').fill('Синтетическое описание объявления для проверки модерации.')
   send=resident.get_by_role('button',name='Отправить на проверку',exact=True)
   failure='**/rest/v1/classifieds?*'
  else:
   resident.get_by_role('navigation',name='Разделы стены').get_by_role('button',name='Предложить запись',exact=True).click()
   resident.get_by_label('Заголовок',exact=True).fill(title)
   resident.get_by_label('Текст записи',exact=True).fill('Синтетическая запись жителя для проверки модерации и отказа.')
   send=resident.get_by_role('button',name='Отправить запись',exact=True)
   failure='**/rest/v1/rpc/'+rpc_name
  photo=base64.b64decode(resident.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.fillStyle='#eab452';x.fillRect(0,0,16,16);return c.toDataURL('image/webp').split(',')[1]}"""))
  resident.locator('input[type="file"]').first.set_input_files([
   {'name':'first.webp','mimeType':'image/webp','buffer':photo},
   {'name':'second.webp','mimeType':'image/webp','buffer':photo}])
  expected_photo_count=2
  if module=='classifieds':
   resident.locator('input[type="file"]').first.set_input_files([
    {'name':f'extra-{i}.webp','mimeType':'image/webp','buffer':photo} for i in range(8)])
   expect(resident.locator('.photo-count')).to_contain_text('Фото: 10 из 10')
   resident.locator('input[type="file"]').first.set_input_files({'name':'eleventh.webp','mimeType':'image/webp','buffer':photo})
   expect(resident.locator('#alert')).to_contain_text('Максимум 10 фотографий')
   expect(resident.locator('.photo-count')).to_contain_text('Фото: 10 из 10')
   expected_photo_count=10
  uploads={'count':0}
  storage_pattern='**/storage/v1/object/'+('ryadom-classified-photos' if module=='classifieds' else 'ryadom-wall-photos')+'/**'
  def fail_second_upload(request):
   if request.request.method=='POST':
    uploads['count']+=1
    if uploads['count']==2:
     request.fulfill(status=400,content_type='application/json',body=json.dumps({'message':'Synthetic upload fault','error':'Synthetic upload fault','statusCode':'400'}))
     return
   request.fallback()
  resident.route(storage_pattern,fail_second_upload)
  fault={'used':False}
  def fail_once(request):
   should_fail=request.request.method==('PATCH' if module=='classifieds' else 'POST')
   if should_fail and not fault['used']:
    fault['used']=True
    request.fulfill(status=503,content_type='application/json',body=json.dumps({'message':'Synthetic retry fault'}))
   else:request.fallback()
  resident.route(failure,fail_once)
  send.click()
  expect(resident.locator('#alert' if module=='classifieds' else '#flash')).to_contain_text('Synthetic upload fault')
  rows=records('seller',table,title)
  assert len(rows)==1 and rows[0]['status']=='draft',rows
  first_id=rows[0]['id']
  send.click()
  expect(resident.locator('#alert' if module=='classifieds' else '#flash')).to_contain_text('Synthetic retry fault')
  rows=records('seller',table,title)
  assert len(rows)==1 and rows[0]['status']=='draft',rows
  assert rows[0]['id']==first_id
  send.click()
  expect(resident.get_by_role('heading',name=title,exact=True)).to_be_visible()
  rows=records('seller',table,title)
  assert len(rows)==1 and rows[0]['id']==first_id and rows[0]['status']=='pending',rows
  resident.unroute(failure,fail_once)
  resident.unroute(storage_pattern,fail_second_upload)
  photo_table='classified_photos' if module=='classifieds' else 'community_post_photos'
  photo_key='listing_id' if module=='classifieds' else 'post_id'
  code,photos=api('seller','GET',f'/rest/v1/{photo_table}?select=id,object_path&{photo_key}=eq.{first_id}')
  assert code==200 and len(photos)==expected_photo_count,(module,code,photos)
  # Real server permissions: hidden from guests, other residents, foreign staff.
  for role in [None,'buyer','foreign_editor']:
   assert records(role,table,title)==[],(module,role)
  review='review_classified_with_reason' if module=='classifieds' else 'review_community_post_with_reason'
  id_key='p_listing_id' if module=='classifieds' else 'p_id'
  for role in ['seller','foreign_editor']:
   rpc(role,review,{id_key:first_id,'p_approve':True,'p_reason':None},403)
  code,_=api('seller','PATCH',f'/rest/v1/{table}?id=eq.{first_id}',{'status':'published'})
  assert code in (200,403) and records('seller',table,title)[0]['status']=='pending'
  rpc('editor',review,{id_key:first_id,'p_approve':False,'p_reason':None},400)
  # Reject through the actual city editor UI and correct through the resident UI.
  editor.goto(origin+'/host/'+module+'/?view='+('moderation' if module=='classifieds' else 'admin'))
  selector='.moderation-card' if module=='classifieds' else 'article.post'
  card=editor.locator(selector).filter(has=editor.get_by_role('heading',name=title,exact=True))
  reason='Укажите подробности для публикации после проверки.'
  if module=='classifieds':
   editor.once('dialog',lambda dialog:dialog.accept(reason))
   card.get_by_role('button',name='Отклонить',exact=True).click()
  else:
   card.get_by_role('button',name='Отклонить',exact=True).click()
   editor.get_by_label('Причина отказа',exact=True).fill(reason)
   editor.get_by_role('button',name='Отклонить с причиной',exact=True).click()
  expect(card).to_have_count(0)
  history='classified_moderation_history' if module=='classifieds' else 'community_post_review_reasons'
  reason_key='listing_id' if module=='classifieds' else 'post_id'
  for role in ['buyer','foreign_editor']:
   code,hidden=api(role,'GET',f'/rest/v1/{history}?select=reason&{reason_key}=eq.{first_id}')
   assert code==200 and hidden==[],(module,role,code)
  resident.reload()
  resident.get_by_role('button',name='Мои объявления' if module=='classifieds' else 'Мои записи',exact=True).click()
  expect(resident.get_by_text(('Причина отклонения: ' if module=='classifieds' else 'Причина отказа: ')+reason,exact=True)).to_be_visible()
  resident.get_by_role('button',name='Редактировать' if module=='classifieds' else 'Редактировать и добавить медиа',exact=True).click()
  if module=='classifieds':
   resident.locator('textarea[name="description"]').fill('Уточнённое подробное описание для повторной проверки объявления.')
   resident.get_by_role('button',name='Отправить на проверку',exact=True).click()
  else:
   resident.get_by_label('Текст записи',exact=True).fill('Уточнённый подробный текст записи для повторной проверки.')
   resident.get_by_role('button',name='Сохранить изменения',exact=True).click()
   resident.get_by_role('button',name='Отправить',exact=True).click()
  expect(resident.locator('article').filter(has=resident.get_by_role('heading',name=title,exact=True)).locator('.pending')).to_be_visible()
  # The global owner reviews the resubmitted post through the real UI.
  owner.goto(origin+'/host/'+module+'/?view='+('moderation' if module=='classifieds' else 'admin'))
  approval_rpc='review_classified_with_reason' if module=='classifieds' else 'review_community_post'
  with owner.expect_response(lambda response:approval_rpc in response.url and response.request.method=='POST') as approval:
   owner.locator(selector).filter(has=owner.get_by_role('heading',name=title,exact=True)).get_by_role('button',name='Одобрить' if module=='classifieds' else 'Опубликовать',exact=True).click()
  assert approval.value.status in (200,204),(module,approval.value.status,approval.value.text())
  assert records(None,table,title)[0]['status']=='published'
  guest.goto(origin+'/host/'+module+'/')
  expect(guest.get_by_role('heading',name=title,exact=True)).to_be_visible()
  if module=='wall':
   rpc('owner','set_community_wall_settings',{'p_city':'Енисейск','p_posts_mode':'review','p_comments_mode':'open'})
   resident.goto(origin+'/host/wall/')
   resident_post=resident.locator('article.post').filter(has=resident.get_by_role('heading',name=title,exact=True))
   expect(resident_post.get_by_label('Написать комментарий',exact=True)).to_be_visible()
   resident_post.get_by_label('Написать комментарий',exact=True).fill('Собственный комментарий для проверки удаления.')
   resident_post.get_by_role('button',name='Отправить',exact=True).click()
   comment=resident_post.locator('.comment').filter(has_text='Собственный комментарий для проверки удаления.')
   expect(comment.get_by_role('button',name='Удалить свой комментарий',exact=True)).to_be_visible()
   code,comments=api('seller','GET',f'/rest/v1/community_comments?select=id&post_id=eq.{first_id}&status=eq.published')
   assert code==200 and len(comments)==1,(code,comments)
   rpc('buyer','delete_community_comment',{'p_id':comments[0]['id']},403)
   guest.reload()
   expect(guest.get_by_role('button',name='Удалить свой комментарий',exact=True)).to_have_count(0)
   parent=rpc('buyer','submit_community_comment',{'p_post_id':first_id,'p_body':'Комментарий другого жителя для ответа.'})
   resident.reload()
   other=resident_post.locator('.comment').filter(has_text='Комментарий другого жителя для ответа.')
   other.get_by_role('button',name='Ответить',exact=True).click()
   expect(resident_post.locator('.comment-reply-target')).to_contain_text('Комментарий другого жителя для ответа.')
   resident_post.get_by_label('Написать комментарий',exact=True).fill('Ответ соседу без открытия новой страницы.')
   resident_post.get_by_role('button',name='Отправить',exact=True).click()
   expect(resident_post.locator('.comment-reply').filter(has_text='Ответ соседу без открытия новой страницы.')).to_be_visible()
   code,replies=api('seller','GET',f'/rest/v1/community_comments?select=id,reply_to&post_id=eq.{first_id}&reply_to=eq.{parent}')
   assert code==200 and len(replies)==1,(code,replies)
   rpc('buyer','delete_community_comment',{'p_id':parent})
   resident.reload()
   expect(resident_post.get_by_text('Ответ соседу без открытия новой страницы.',exact=True)).to_be_visible()
   expect(resident_post.get_by_label('Написать комментарий',exact=True)).to_be_visible()
   resident.once('dialog',lambda dialog:dialog.accept())
   comment.get_by_role('button',name='Удалить свой комментарий',exact=True).click()
   expect(resident_post.get_by_text('Собственный комментарий для проверки удаления.',exact=True)).to_have_count(0)
   guest.reload()
   expect(guest.get_by_text('Собственный комментарий для проверки удаления.',exact=True)).to_have_count(0)
   passed('resident writes without expanding comments; only author can remove; deletion disappears for guest')
  if module=='classifieds':
   for role in ['seller','editor','foreign_editor']:
    rpc(role,'owner_pin_classified',{'p_id':first_id,'p_pin':True},403)
   owner.goto(origin+'/host/classifieds/')
   owner.get_by_role('button',name='Закрепить объявление: '+title,exact=True).click()
   expect(owner.get_by_role('button',name='Открепить объявление: '+title,exact=True)).to_be_visible()
   guest.reload()
   expect(guest.locator('article').filter(has=guest.get_by_role('heading',name=title,exact=True)).locator('.listing-pin-badge')).to_be_visible()
   expect(guest.get_by_role('button',name='Открепить объявление: '+title,exact=True)).to_have_count(0)
   owner.get_by_role('button',name='Открепить объявление: '+title,exact=True).click()
   expect(owner.get_by_role('button',name='Закрепить объявление: '+title,exact=True)).to_be_visible()
   passed('owner-only published classified pin/unpin through real UI and RPC; guest badge; residents and city staff denied')
  guest.locator('#city').select_option('Лесосибирск')
  expect(guest.get_by_role('heading',name=title,exact=True)).to_have_count(0)
  passed(module+f': upload and submit retries keep one ID and {expected_photo_count} photos; draft/pending private; resident and foreign staff denied; rejection reason; correction; owner approval; public feed separated by city')
 # Server role matrix in a future city, with genuine local Auth JWTs.
 # Fixture-only setup uses psql in stack.py, never a browser service key.
 future_city='Новый город проверки'
 code,created_city=api('owner','POST','/rest/v1/city_directory?select=name',{'name':future_city,'region':'Тестовая область'})
 assert code==201,(code,created_city)
 for role,city,should_review in [('owner',future_city,True),('editor','Енисейск',False)]:
  post=rpc(role,'create_community_post',{'p_city':city,'p_type':'post','p_title':'Своя запись '+role,'p_body':'Синтетическая собственная запись для проверки роли.'})
  rpc(role,'community_submit_post',{'p_post_id':post})
  rpc(role,'review_community_post_with_reason',{'p_id':post,'p_approve':True,'p_reason':None},200 if should_review else 403)
  code,rows=api(role,'POST','/rest/v1/classifieds?select=id',{'city':city,'title':'Своё объявление '+role,'description':'Синтетическое собственное объявление для проверки роли.','deal_type':'sell','category':'Другое'})
  assert code==201,(role,code,rows)
  listing=rows[0]['id']
  code,_=api(role,'PATCH',f'/rest/v1/classifieds?id=eq.{listing}',{'status':'pending'})
  assert code==200
  rpc(role,'review_classified_with_reason',{'p_listing_id':listing,'p_approve':True,'p_reason':None},200 if should_review else 403)
 passed('global owner can moderate own posts and listings in a future city; city editor cannot approve own submissions')
 # Finish intercepted API responses before disposing the context's request client.
 # Stop page timers first; removing the route must never allow external requests.
 for context in contexts:
  for page in context.pages:page.goto('about:blank',wait_until='commit')
  context.unroute_all(behavior='wait')
  context.close()
 browser.close()
(args.workdir/'host-moderation-report.json').write_text(json.dumps({'backend':'disposable local Auth/PostgreSQL/PostgREST/Storage','checks':results,'cloud_writes':False},ensure_ascii=False,indent=2))
