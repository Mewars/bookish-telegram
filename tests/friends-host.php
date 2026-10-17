<?php
declare(strict_types=1);
require __DIR__.'/../server/friends-core.php';
$dir=sys_get_temp_dir().'/ryadom-friends-test-'.bin2hex(random_bytes(8));mkdir($dir,0700);
register_shutdown_function(static function()use($dir){foreach(glob($dir.'/*') as $file)unlink($file);rmdir($dir);});
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function denied(callable $operation,?string $code=null):void{try{$operation();}catch(NearbyFailure $e){if($code!==null)check($e->errorCode===$code,'Unexpected rejection reason');return;}throw new RuntimeException('Private operation unexpectedly succeeded');}
$store=new NearbyStore($dir);$now=1800000000;
$id=static fn(int $n)=>sprintf('00000000-0000-4000-8000-%012d',$n);
$a=$id(1);$b=$id(2);$outsider=$id(3);
$call=static fn(string $u,string $op,array $p=[])=>$store->call($u,$op,$p,$now);
$state=static fn(string $u)=>$call($u,'nearby_state');
check($state($a)['self']['latitude']===null,'New account must be invisible');
$code=$call($a,'nearby_invite',['p_name'=>'Анна']);
$call($b,'nearby_request',['p_code'=>$code,'p_name'=>'Михаил']);
check(!$state($a)['friends'][0]['accepted'],'Invitation must not accept itself');
check($state($a)['friends'][0]['latitude']===null,'Pending recipient must not see a point');
denied(fn()=>$call($b,'nearby_respond',['p_peer'=>$a,'p_accept'=>true]),'42501');
$call($a,'nearby_respond',['p_peer'=>$b,'p_accept'=>true]);
check($state($b)['friends'][0]['accepted'],'Recipient approval must work');
denied(fn()=>$call($a,'nearby_start_sharing'),'22023');
$start=static fn(string $u)=>$call($u,'nearby_start_sharing',['p_consent_version'=>'FRIENDS-GEO-1.0']);
$token=$start($a);
denied(fn()=>$call($b,'nearby_share',['p_lat'=>58.455678,'p_lon'=>92.176543,'p_token'=>$token]),'42501');
denied(fn()=>$call($a,'nearby_share',['p_lat'=>91,'p_lon'=>0,'p_token'=>$token]),'22023');
$call($a,'nearby_share',['p_lat'=>58.455678,'p_lon'=>92.176543,'p_token'=>$token]);
$point=$state($b)['friends'][0];check($point['latitude']===58.46&&$point['longitude']===92.18,'Server must round coordinates');
check(strtotime($point['expires_at'])===$now+3600,'Point must expire in an hour');
check($state($outsider)['friends']===[],'Outsider must not see friend graph or coordinates');
denied(fn()=>$call($a,'nearby_share',['p_lat'=>0,'p_lon'=>0,'p_token'=>$token]),'42501');
$call($a,'nearby_hide');check($state($b)['friends'][0]['latitude']===null,'Hide must revoke access immediately');
$late=$start($a);$call($a,'nearby_hide');denied(fn()=>$call($a,'nearby_share',['p_lat'=>0,'p_lon'=>0,'p_token'=>$late]),'42501');
$fresh=$start($a);$call($a,'nearby_share',['p_lat'=>58.45,'p_lon'=>92.17,'p_token'=>$fresh]);
check($store->call($b,'nearby_state',[],$now+3601)['friends'][0]['latitude']===null,'Expired point must not be served');
$call($a,'nearby_disconnect',['p_peer'=>$b,'p_block'=>true]);check($state($b)['friends']===[],'Block must remove friend graph');
denied(fn()=>$call($b,'nearby_request',['p_code'=>$code,'p_name'=>'Михаил']),'42501');
denied(fn()=>$call($outsider,'nearby_disconnect',['p_peer'=>$a,'p_block'=>true]),'42501');
$call($a,'nearby_disconnect',['p_peer'=>$b,'p_block'=>false]);check($state($b)['friends']===[],'Unblock must not restore friendship');
$new=$call($a,'nearby_invite',['p_name'=>'Анна']);check($new!==$code,'Code must rotate');
denied(fn()=>$call($b,'nearby_request',['p_code'=>$code,'p_name'=>'Михаил']),'42501');
for($i=10;$i<20;$i++){$c=$call($id($i),'nearby_invite',['p_name'=>'Друг '.$i]);$call($outsider,'nearby_request',['p_code'=>$c,'p_name'=>'Тест']);}
$extra=$call($id(20),'nearby_invite',['p_name'=>'Друг 20']);
denied(fn()=>$call($outsider,'nearby_request',['p_code'=>$extra,'p_name'=>'Тест']),'54000');
$call($outsider,'nearby_disconnect',['p_peer'=>$id(10),'p_block'=>false]);
$call($outsider,'nearby_forget');
denied(fn()=>$call($outsider,'nearby_request',['p_code'=>$extra,'p_name'=>'Тест']),'54000');
$limited=false;for($i=0;$i<62;$i++){try{$call($id(99),'nearby_request',['p_code'=>str_repeat('0',32),'p_name'=>'Тест']);}catch(NearbyFailure $e){if($e->errorCode==='42900'){$limited=true;break;}}}
check($limited,'Rejected guesses must consume rate limits');
check((fileperms($dir.'/friends.sqlite')&0777)===0600,'Database must be private');
$forgotten=$start($b);$call($b,'nearby_forget');check($state($b)['friends']===[]&&$state($b)['self']['invite_code']===null,'Deleting section data must remove its profile and graph');
denied(fn()=>$call($b,'nearby_share',['p_lat'=>58.45,'p_lon'=>92.17,'p_token'=>$forgotten]),'42501');
$victim=$id(30);$blocked=$id(31);$victimCode=$call($victim,'nearby_invite',['p_name'=>'Знакомый']);
$call($blocked,'nearby_request',['p_code'=>$victimCode,'p_name'=>'Заявитель']);
$call($victim,'nearby_disconnect',['p_peer'=>$blocked,'p_block'=>true]);
$call($blocked,'nearby_forget');
check(count($state($victim)['blocked'])===1,'A peer must not erase another user block by forgetting their own profile');
$call($blocked,'nearby_invite',['p_name'=>'Новое имя']);
denied(fn()=>$call($blocked,'nearby_request',['p_code'=>$victimCode,'p_name'=>'Новое имя']),'42501');
echo "PASS: private SQLite invitations, consent, rounding, expiry, hide/replay, blocks, quotas and permissions\n";
