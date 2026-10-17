<?php
declare(strict_types=1);
require_once __DIR__.'/friends-core.php';

function nearby_authenticated_user(array $config,string $bearer): string {
    $origin=$config['auth_origin']??'';
    $local=PHP_SAPI==='cli-server'&&getenv('RYADOM_FRIENDS_LOCAL_E2E')==='1';
    if($origin!=='https://cptbmepnbzogqkfhflsg.supabase.co'&&!($local&&preg_match('~^http://127\.0\.0\.1:[0-9]+$~D',$origin)))throw new NearbyFailure('unavailable',503);
    $key=$config['public_key']??'';
    if(!is_string($key)||$key===''||(!$local&&!preg_match('/^sb_publishable_[a-zA-Z0-9_-]+$/D',$key)))throw new NearbyFailure('unavailable',503);
    if(!preg_match('/^Bearer ([a-zA-Z0-9_.-]{30,8192})$/D',$bearer,$match))throw new NearbyFailure('unauthorized',401);
    $curl=curl_init($origin.'/auth/v1/user');$body='';
    $protocolOption=defined('CURLOPT_PROTOCOLS_STR')?constant('CURLOPT_PROTOCOLS_STR'):CURLOPT_PROTOCOLS;
    $protocolValue=defined('CURLOPT_PROTOCOLS_STR')?($local?'http':'https'):($local?CURLPROTO_HTTP:CURLPROTO_HTTPS);
    curl_setopt_array($curl,[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$match[1],'apikey: '.$key],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,$protocolOption=>$protocolValue,CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use(&$body):int{if(strlen($body)+strlen($chunk)>131072)return 0;$body.=$chunk;return strlen($chunk);}]);
    $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
    if($status===401||$status===403)throw new NearbyFailure('unauthorized',401);
    if($ok===false||$status!==200)throw new NearbyFailure('unavailable',503);
    // Identity comes only from the Auth server, never from decoded/unverified JWTs.
    $user=json_decode($body,true);
    if(!is_array($user)||($user['role']??'')!=='authenticated'||($user['is_anonymous']??false)===true||!is_string($user['id']??null)||!preg_match('/^[a-f0-9-]{36}$/D',$user['id']))throw new NearbyFailure('unauthorized',401);
    if(!empty($user['banned_until'])&&strtotime($user['banned_until'])>time())throw new NearbyFailure('unauthorized',401);
    return $user['id'];
}

function nearby_http(): void {
    header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('Pragma: no-cache');header('Vary: Authorization');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
    try {
        if(($_SERVER['REQUEST_METHOD']??'')==='GET'&&($_GET['health']??'')==='1'){
            $local=PHP_SAPI==='cli-server'&&getenv('RYADOM_FRIENDS_LOCAL_E2E')==='1';
            $directory=$local?(getenv('RYADOM_FRIENDS_DATA_DIR')?:''):'/home/mewars/.ryadom-friends';
            $config=json_decode((string)@file_get_contents($directory.'/config.json'),true);
            if(!$directory||!extension_loaded('pdo_sqlite')||!extension_loaded('curl')||!is_writable($directory)||!is_writable($directory.'/friends.sqlite')||!is_array($config)||($config['enabled']??false)!==true||(fileperms($directory.'/friends.sqlite')&0077)!==0)throw new NearbyFailure('unavailable',503);
            echo '{"ready":true,"backend":"host"}';return;
        }
        if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){header('Allow: POST');throw new NearbyFailure('method_not_allowed',405);}
        $local=PHP_SAPI==='cli-server'&&getenv('RYADOM_FRIENDS_LOCAL_E2E')==='1';
        $origin=$_SERVER['HTTP_ORIGIN']??'';
        if($origin!==''&&$origin!=='https://ryadomcity.ru'&&!($local&&preg_match('~^http://127\.0\.0\.1:[0-9]+$~D',$origin)))throw new NearbyFailure('forbidden',403);
        if(stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0)throw new NearbyFailure('content_type',415);
        if((int)($_SERVER['CONTENT_LENGTH']??0)>8192)throw new NearbyFailure('too_large',413);
        $raw=file_get_contents('php://input',false,null,0,8193);
        if($raw===false||strlen($raw)>8192)throw new NearbyFailure('too_large',413);
        $body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
        $methods=['nearby_state','nearby_invite','nearby_request','nearby_respond','nearby_disconnect','nearby_start_sharing','nearby_share','nearby_hide','nearby_forget'];
        if(!is_array($body)||!in_array($body['name']??null,$methods,true)||!is_array($body['params']??[]))throw new NearbyFailure('22023');
        $header=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';
        if($header===''&&function_exists('getallheaders'))foreach(getallheaders() as $name=>$value)if(strcasecmp($name,'Authorization')===0)$header=$value;
        if($header==='')throw new NearbyFailure('missing_authorization',401);
        $directory=$local?(getenv('RYADOM_FRIENDS_DATA_DIR')?:''):'/home/mewars/.ryadom-friends';
        if($directory===''||is_link($directory)||!is_file($directory.'/config.json'))throw new NearbyFailure('unavailable',503);
        $config=json_decode((string)file_get_contents($directory.'/config.json'),true,8,JSON_THROW_ON_ERROR);
        if(!is_array($config)||($config['enabled']??false)!==true)throw new NearbyFailure('unavailable',503);
        $uid=nearby_authenticated_user($config,$header);
        $result=(new NearbyStore($directory))->call($uid,$body['name'],$body['params']??[]);
        echo json_encode(['data'=>$result,'error'=>null],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    }catch(NearbyFailure $e){http_response_code($e->httpStatus);echo json_encode(['data'=>null,'error'=>['code'=>$e->errorCode]]);}
    catch(JsonException $e){http_response_code(400);echo '{"data":null,"error":{"code":"22023"}}';}
    catch(Throwable $e){http_response_code(503);echo '{"data":null,"error":{"code":"unavailable"}}';}
}
