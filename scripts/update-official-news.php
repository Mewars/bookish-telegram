<?php
declare(strict_types=1);
// A fixed public source; no user-controlled URL, credentials, redirects or article HTML in the feed.
const NEWS_SOURCE = 'https://eniseysk.gosuslugi.ru/dlya-zhiteley/novosti-i-reportazhi/';
const NEWS_ORIGIN = 'https://eniseysk.gosuslugi.ru';
function news_text(string $value): string { return trim(preg_replace('/\s+/u', ' ', html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? ''); }
function news_document(string $html): DOMXPath {
    $dom = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors(); libxml_use_internal_errors($previous);
    return new DOMXPath($dom);
}
function news_article_url(string $href): ?string {
    if (str_starts_with($href, '/')) $href = NEWS_ORIGIN.$href;
    elseif (!preg_match('~^https?://~i', $href)) $href = NEWS_SOURCE.$href;
    $url = parse_url($href);
    if (($url['scheme'] ?? '') !== 'https' || ($url['host'] ?? '') !== 'eniseysk.gosuslugi.ru' || isset($url['user']) || isset($url['pass']) || isset($url['port'])) return null;
    $path = $url['path'] ?? '';
    return preg_match('~^/dlya-zhiteley/novosti-i-reportazhi/novosti_[0-9]+\.html$~D', $path) ? NEWS_ORIGIN.$path : null;
}
function news_links(string $html): array {
    $xpath = news_document($html); $links = [];
    foreach ($xpath->query('//a[@href]') as $link) {
        $url = news_article_url($link->getAttribute('href'));
        if ($url) $links[$url] = true;
    }
    return array_slice(array_keys($links), 0, 6);
}
function news_article(string $html, string $url): ?array {
    if (!news_article_url($url)) return null;
    $xpath = news_document($html);
    $heading = $xpath->query('//h1')->item(0);
    $title = $heading ? news_text($heading->textContent) : '';
    if (strlen($title) < 5 || strlen($title) > 1400) return null;
    $date = '';
    foreach ($xpath->query('//time[@datetime]/@datetime | //meta[@property="article:published_time"]/@content | //meta[@itemprop="datePublished"]/@content') as $node) {
        if (preg_match('/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/', trim($node->nodeValue), $m)) { $date=$m[1]; break; }
    }
    if (!$date) {
        $text = news_text($xpath->document->textContent);
        if (preg_match('/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})\s*,?\s+\d{1,2}:\d{2}/u', $text, $m)) {
            $months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
            $date=sprintf('%s-%02d-%02d',$m[3],array_search($m[2],$months,true)+1,(int)$m[1]);
        }
    }
    if (!$date || !checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4))) return null;
    return ['title'=>$title,'date'=>$date,'url'=>$url];
}
function news_fetch(string $url): string {
    $curl=curl_init($url);
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_USERAGENT=>'RYADOM/1.0 (+https://ryadomcity.ru/; public municipal news headlines)']);
    $body=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);$error=curl_error($curl);curl_close($curl);
    if ($status!==200 || !is_string($body) || strlen($body)>4000000) throw new RuntimeException('Official source HTTP '.$status.($error?' (network error)':''));
    return $body;
}
function update_official_news(): void {
    $root='/home/mewars/domains/ryadomcity.ru/public_html';
    if (realpath($root)!==$root || !is_file($root.'/index.html')) throw new RuntimeException('Unexpected publication directory');
    $listing=news_fetch(NEWS_SOURCE);$links=news_links($listing);
    if (!$links) throw new RuntimeException('No recognized article links; existing feed kept. Public HTML structure: '.json_encode(['title'=>news_text(news_document($listing)->query('//title')->item(0)?->textContent ?? ''),'bytes'=>strlen($listing)],JSON_UNESCAPED_UNICODE));
    $items=[];
    foreach ($links as $url) {
        $article=news_article(news_fetch($url),$url);
        if ($article && $article['date']<=date('Y-m-d')) $items[]=$article;
        if (count($items)===3) break;
    }
    if (!$items) throw new RuntimeException('No dated articles; existing feed kept');
    usort($items,fn($a,$b)=>strcmp($b['date'],$a['date']));
    $feed=['city'=>'Енисейск','sourceName'=>'Администрация Енисейска','sourceUrl'=>NEWS_SOURCE,'checkedAt'=>gmdate('c'),'items'=>$items];
    $directory=$root.'/news';
    if (!is_dir($directory) && !mkdir($directory,0755,true)) throw new RuntimeException('Cannot create news directory');
    $json=json_encode($feed,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $temporary=tempnam($directory,'.news-');
    try {
        if (!$temporary || file_put_contents($temporary,$json,LOCK_EX)===false || !chmod($temporary,0644) || !rename($temporary,$directory.'/eniseysk.json')) throw new RuntimeException('Cannot publish news feed');
    } finally { if ($temporary && is_file($temporary)) unlink($temporary); }
    echo $json.PHP_EOL;
}
if (!defined('RYADOM_NEWS_TEST')) {
    try { update_official_news(); } catch (Throwable $e) { fwrite(STDERR,$e->getMessage().PHP_EOL); exit(1); }
}
