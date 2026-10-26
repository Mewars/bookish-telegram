import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('feeds',Path(__file__).resolve().parents[1]/'scripts/update-city-feeds.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TODAY=dt.date(2026,10,26)
class FeedTests(unittest.TestCase):
 def post(self,text='Приглашаем на спектакль «Проверка афиши» 28 октября в 16:00. Билеты в кассе.'):
  return {'id':7,'owner_id':-10,'date':int(dt.datetime(2026,10,25,tzinfo=m.ZONE).timestamp()),'text':text,'attachments':[{'type':'photo','photo':{'sizes':[{'width':800,'height':1000,'url':'https://sun1.userapi.com/poster.jpg'}]}}]}
 def test_only_future_dated_posters(self):
  p=self.post();entry=m.poster(p,m.SOURCES[1],TODAY)
  self.assertEqual(entry['eventStart'],'2026-10-28');self.assertEqual(entry['time'],'16:00')
  self.assertEqual(entry['sourceUrl'],'https://vk.ru/wall-10_7')
  for text in ['Доброе утро, друзья!','28 октября в 16:00 состоялся концерт','Поздравляем! Концерт 28 октября в 16:00','Концерт отменён 28 октября в 16:00','Приглашаем на концерт! Вся информация на картинке','Приглашаем 28 октября и 30 октября в 16:00','Приглашаем на спектакль 20 октября в 16:00']:
   self.assertIsNone(m.poster(self.post(text),m.SOURCES[1],TODAY),text)
  p['attachments']=[];self.assertIsNone(m.poster(p,m.SOURCES[1],TODAY))
  p=self.post();p['copy_history']=[{}];self.assertIsNone(m.poster(p,m.SOURCES[1],TODAY))
  p=self.post();p['attachments'][0]['photo']['sizes'][0]['url']='https://evil.invalid/fake.jpg';self.assertIsNone(m.poster(p,m.SOURCES[1],TODAY))
 def test_dates_use_publication_anchor_not_visitors_year(self):
  self.assertEqual(m.event_dates('Сеансы 23–28 октября 2026',dt.date(2026,10,20),TODAY),('2026-10-23','2026-10-28'))
  self.assertEqual(m.event_dates('Сеансы с 23 по 28 октября',dt.date(2026,10,20),TODAY),('2026-10-23','2026-10-28'))
  self.assertEqual(m.event_dates('Концерт 5 января',dt.date(2026,12,20),dt.date(2026,12,25)),('2027-01-05','2027-01-05'))
  self.assertIsNone(m.event_dates('Концерт 31 февраля',TODAY,TODAY))
  self.assertIsNone(m.event_dates('Концерт 28 октября 2025',dt.date(2025,10,20),TODAY))
  self.assertEqual(m.poster(self.post('Приглашаем на концерт 28.10.2026 в 16.00'),m.SOURCES[1],TODAY)['time'],'16:00')
 def test_calendar_is_russia_only_and_does_not_expand_recurrence(self):
  blocks=[]
  for i in range(110):
   date=dt.date(2026,1,1)+dt.timedelta(days=i)
   blocks.append(f'BEGIN:VEVENT\nCATEGORIES:Праздники России\nDTSTART;VALUE=DATE:{date:%Y%m%d}\nSUMMARY:Тест {i}\nURL:https://www.calend.ru/holidays/0/0/{i+1}/\nRRULE:FREQ=YEARLY\nEND:VEVENT')
  raw=('BEGIN:VCALENDAR\nPRODID:-//calend.ru/russtate///\nX-WR-CALNAME:Calend.ru - Праздники России 2026\n'+'\n'.join(blocks)+'\nEND:VCALENDAR').encode()
  entries=m.calendar_items(raw,2026);self.assertEqual(len(entries),110)
  with self.assertRaises(ValueError):m.calendar_items(raw,2027)
  with self.assertRaises(ValueError):m.calendar_items(raw.replace('Праздники России'.encode(),'Все праздники'.encode()),2026)
  self.assertFalse(m.image_url('https://userapi.com.evil.invalid/a.jpg'))
  self.assertFalse(m.image_url('https://user:password@sun1.userapi.com/a.jpg'))
if __name__=='__main__':unittest.main()
