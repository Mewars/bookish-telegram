<?php
define('RYADOM_NEWS_TEST',true);
require __DIR__.'/../scripts/update-official-news.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$root='https://eniseysk.gosuslugi.ru/dlya-zhiteley/novosti-i-reportazhi/';
check(news_links('<a href="/dlya-zhiteley/novosti-i-reportazhi/novosti_123.html">Новость</a><a href="novosti_123.html">Повтор</a>')===[$root.'novosti_123.html'],'Deduplicate article links');
foreach(['https://evil.test/novosti_1.html','//evil.test/novosti_1.html','javascript:alert(1)','https://user@eniseysk.gosuslugi.ru/dlya-zhiteley/novosti-i-reportazhi/novosti_1.html','https://eniseysk.gosuslugi.ru:8443/dlya-zhiteley/novosti-i-reportazhi/novosti_1.html'] as $url) check(news_article_url($url)===null,'Reject non-source URL');
$a=news_article('<h1>Городская &amp; новость</h1><time datetime="2026-10-26T10:00:00+07:00"></time>',$root.'novosti_1.html');
check($a['title']==='Городская & новость'&&$a['date']==='2026-10-26','Extract title and absolute date');
$a=news_article('<h1>Архивная новость</h1><p>08 октября 2025, 06:32</p>',$root.'novosti_2.html');
check($a['date']==='2025-10-08','Never guess the year from the current date');
check(news_article('<h1>Без подтверждённой даты</h1><p>26 октября, 12:00</p>',$root.'novosti_3.html')===null,'Require explicit year');
check(news_article('<h1>Неверная дата</h1><time datetime="2026-02-30"></time>',$root.'novosti_4.html')===null,'Reject invalid date');
echo "PASS official news parser: dates, duplicate links, fixed source, no guessed years\n";
