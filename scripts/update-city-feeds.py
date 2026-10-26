"""Read-only collection of Russian holidays and dated event posters. Stdlib only.
VK wall.get requires a service/user access token; missing credentials never mean success.
No Supabase writes, browser sessions, page scraping or OCR guesses.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
SOURCES=json.loads((ROOT/'data/afisha-sources.json').read_text())
CALENDAR='https://www.calend.ru/holidays/russtate/'
MONTHS='января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split()
ZONE=dt.timezone(dt.timedelta(hours=7))
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def fetch(url,data=None,limit=5_000_000):
 request=urllib.request.Request(url,data=data,headers={'User-Agent':'RYADOM/1.0 (+https://ryadomcity.ru/; public event calendar)','Content-Type':'application/x-www-form-urlencoded'} if data else {'User-Agent':'RYADOM/1.0 (+https://ryadomcity.ru/; public event calendar)'})
 with urllib.request.build_opener(NoRedirect).open(request,timeout=25) as response:
  value=response.read(limit+1)
  if len(value)>limit:raise ValueError('Source response too large')
  return value

def valid_date(value):
 try:return dt.date.fromisoformat(value)
 except (ValueError,TypeError):return None

def calendar_items(raw,year):
 # RFC 5545 line unfolding; DTSTART is authoritative. Never expand RRULE into other years.
 text=re.sub(r'\r?\n[ \t]','',raw.decode('utf-8-sig'))
 if 'calend.ru/russtate/' not in text or 'X-WR-CALNAME:Calend.ru - Праздники России' not in text:raise ValueError('Wrong calendar source')
 result={}
 for block in text.split('BEGIN:VEVENT')[1:]:
  fields={}
  for line in block.split('END:VEVENT',1)[0].splitlines():
   key,sep,value=line.partition(':')
   if sep:fields[key.split(';')[0]]=value
  date=fields.get('DTSTART','')
  if not re.fullmatch(r'\d{8}',date):continue
  date=f'{date[:4]}-{date[4:6]}-{date[6:]}'
  title=fields.get('SUMMARY','').replace('\\,',',').replace('\\;', ';').replace('\\n',' ').replace('\\\\','\\').strip()
  url=fields.get('URL','')
  if not valid_date(date) or int(date[:4])!=year or not 3<=len(title)<=250 or not re.fullmatch(r'https://www\.calend\.ru/holidays/0/0/\d+(?:/\d+)?/',url):continue
  if fields.get('CATEGORIES')!='Праздники России':continue
  result[date,url]={'date':date,'title':title,'sourceUrl':url,'description':'По календарю «Праздники России» Calend.ru.'}
 if len(result)<100:raise ValueError('Incomplete Russian calendar')
 return sorted(result.values(),key=lambda x:(x['date'],x['title']))

def event_dates(text,published,today):
 pattern=r'(?<!\d)(?:(\d{1,2})\s*(?:[–—-]|по)\s*)?(\d{1,2})\s+('+ '|'.join(MONTHS)+r')(?:\s+(20\d{2}))?(?!\d)'
 dates=[]
 for match in re.finditer(pattern,text,re.I):
  first,last,month,year=match.groups();month=MONTHS.index(month.lower())+1
  years=[int(year)] if year else [published.year,published.year+1]
  candidates=[]
  for y in years:
   try:start=dt.date(y,month,int(first or last));end=dt.date(y,month,int(last))
   except ValueError:continue
   if start<=end and published<=start<=published+dt.timedelta(days=120):candidates.append((start,end))
  if len(candidates)==1:dates.append(candidates[0])
 for match in re.finditer(r'(?<!\d)(\d{1,2})\.(\d{1,2})\.(20\d{2})(?!\d)',text):
  day,month,year=map(int,match.groups())
  try:date=dt.date(year,month,day)
  except ValueError:continue
  if published<=date<=published+dt.timedelta(days=120):dates.append((date,date))
 dates=list(dict.fromkeys(dates))
 if len(dates)!=1:return None
 start,end=dates[0]
 return (start.isoformat(),end.isoformat()) if today<=end<=today+dt.timedelta(days=120) else None

def image_url(value):
 try:
  url=urllib.parse.urlsplit(value)
  return url.scheme=='https' and not url.username and not url.password and not url.port and any((url.hostname or '').endswith('.'+domain) for domain in ['userapi.com','vkuserphoto.ru','vkuserphoto.com','vk-cdn.net'])
 except (ValueError,TypeError):return False

def poster(post,source,today):
 text=re.sub(r'\[(?:club|id)\d+\|([^\]]+)\]',r'\1',str(post.get('text',''))).strip()
 if post.get('copy_history') or post.get('marked_as_ads') or post.get('is_deleted') or not isinstance(post.get('owner_id'),int) or post['owner_id']>=0:return None
 if re.search(r'состоял[аоис]|прош[её]л|прошла|фотоотч[её]т|благодарим|отмен[аеёя]|перен[её]с|поздравляем',text,re.I):return None
 if not re.search(r'приглаша[ею]|состоится|афиша|расписание|сеанс|спектакль|концерт|премьера|показ|билеты',text,re.I):return None
 try:published=dt.datetime.fromtimestamp(int(post['date']),ZoneInfo(source['timeZone'])).date()
 except (KeyError,ValueError,TypeError,OverflowError):return None
 dates=event_dates(text,published,today)
 times=list(dict.fromkeys((value.replace('.',':') for value in re.findall(r'(?<![\d.])(?:[01]?\d|2[0-3])[:.][0-5]\d(?!\d|\.\d)',text))))
 if not dates or not times:return None
 photos=[attachment.get('photo',{}) for attachment in post.get('attachments',[]) if attachment.get('type')=='photo']
 if not photos:return None
 options=[size for photo in photos for size in photo.get('sizes',[]) if image_url(size.get('url','')) and 200<=size.get('width',0)<=1600]
 if not options:return None
 picture=max(options,key=lambda size:size.get('width',0)*size.get('height',0))['url']
 quote=re.search(r'[«"]([^»"\n]{5,120})[»"]',text)
 title=quote.group(1) if quote else next((line.strip(' #*!📌🎭🎬🎤📅') for line in text.splitlines() if len(line.strip())>=5),'')[:140]
 if source['category']=='Кино':title=source.get('scheduleTitle',source['name']+' · кино')
 category='Театр' if re.search('спектакль|театр',text,re.I) else 'Концерты' if re.search('концерт',text,re.I) else source['category']
 age=re.search(r'(?<!\d)(0|6|12|16|18)\s*\+',text)
 return {'id':f"vk-event-{abs(post['owner_id'])}-{int(post['id'])}",'city':source['city'],'kind':'events','title':title,'category':category,'description':f"{source['name']} · {', '.join(times[:8])}. Подробности и возможные изменения — в публикации организатора.",'details':text[:800],'provider':source['name'],'address':source['address'],'eventStart':dates[0],'eventEnd':dates[1],'eventTimeZone':source['timeZone'],'time':' · '.join(times[:8]),'label':age.group(0).replace(' ','') if age else '', 'sourceUrl':f"https://vk.ru/wall{post['owner_id']}_{int(post['id'])}",'sourceGroup':source['domain'],'sourceType':'official_social','imageSource':picture}

def write_json(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')));temporary.replace(path)

def collect(out,now=None,token=None):
 now=now or dt.datetime.now(dt.timezone.utc);today=now.astimezone(ZONE).date();checked=now.isoformat();out=Path(out);public=out/'public';report={}
 try:
  items=[]
  # UTC+2 through UTC+12 covers Russian cities, including both years around New Year.
  for year in sorted({(now+dt.timedelta(hours=2)).year,(now+dt.timedelta(hours=12)).year}):
   url=f'https://www.calend.ru/ical/ical-russtate.ics?v=yy{year}&b=1'
   items.extend(calendar_items(fetch(url),year))
  write_json(public/'feeds/calendar-ru.json',{'sourceUrl':CALENDAR,'checkedAt':checked,'items':items});report['calendar']={'status':'ok','items':len(items)}
 except Exception:report['calendar']={'status':'unavailable'}
 token=token if token is not None else os.environ.get('VK_AFISHA_ACCESS_TOKEN','')
 if not token:report['vk']={'status':'not_configured','reason':'VK_AFISHA_ACCESS_TOKEN is missing'}
 else:
  try:
   items=[];counts={}
   for source in SOURCES:
    body=urllib.parse.urlencode({'domain':source['domain'],'count':100,'filter':'owner','access_token':token,'v':'5.199'}).encode()
    response=json.loads(fetch('https://api.vk.com/method/wall.get',body))
    if 'error' in response:raise ValueError('VK API rejected access')
    posts=response.get('response',{}).get('items')
    if not isinstance(posts,list):raise ValueError('Invalid VK response')
    counts[source['domain']]={'read':len(posts),'accepted':0}
    for post in posts:
     if len(items)>=100:break
     entry=poster(post,source,now.astimezone(ZoneInfo(source['timeZone'])).date())
     if not entry:continue
     try:
      raw=fetch(entry.pop('imageSource'),limit=4_000_000)
      ext='jpg' if raw.startswith(b'\xff\xd8\xff') else 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None
      if not ext:continue
      digest=hashlib.sha256(raw).hexdigest()[:12];name=entry['id']+'-'+digest+'.'+ext
      path=public/'events/imported'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
      entry['image']='/events/imported/'+name;entry['updatedAt']=checked;items.append(entry);counts[source['domain']]['accepted']+=1
     except Exception:continue
   write_json(public/'feeds/afisha-vk.json',{'checkedAt':checked,'items':items});report['vk']={'status':'ok','sources':counts,'items':len(items)}
  except Exception:report['vk']={'status':'unavailable','reason':'VK API or poster source is unavailable; previous feed is preserved'}
 write_json(out/'collection-report.json',report)
 print(json.dumps(report,ensure_ascii=False))
 if report['calendar']['status']!='ok':raise RuntimeError('Russian calendar collection failed')

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();collect(args.out)
