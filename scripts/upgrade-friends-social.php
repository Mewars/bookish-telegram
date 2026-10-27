<?php
// CLI only. Online SQLite copy and a narrow upgrade; never changes config.json or cron.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
function upgrade_friends_social(string $private,array $expected): array {
    if(count($expected)!==4)throw new RuntimeException('Expected four reviewed module hashes');
    foreach($expected as $hash)if(!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new RuntimeException('Invalid module hash');
    if(!extension_loaded('pdo_sqlite'))throw new RuntimeException('CLI PHP needs pdo_sqlite');
    if(!is_dir($private)||is_link($private)||realpath($private)!==$private||is_link($private.'/server'))throw new RuntimeException('Unexpected private path');
    foreach(['friends.sqlite','config.json','server/friends-core.php','server/friends-http.php'] as $file)if(!is_file($private.'/'.$file)||is_link($private.'/'.$file))throw new RuntimeException('Missing or unsafe private file');
    if((fileperms($private.'/friends.sqlite')&0077)!==0)throw new RuntimeException('SQLite permissions are not private');
    [$oldCore,$oldHttp,$newCore,$newHttp]=$expected;
    $core=$private.'/server/friends-core.php';$http=$private.'/server/friends-http.php';
    if(!in_array(hash_file('sha256',$core),[$oldCore,$newCore],true)||!in_array(hash_file('sha256',$http),[$oldHttp,$newHttp],true))throw new RuntimeException('Live module has manual changes; refusing to overwrite');
    $changed=hash_file('sha256',$core)!==$newCore||hash_file('sha256',$http)!==$newHttp;
    if($changed){foreach([[$core,$newCore],[$http,$newHttp]] as [$file,$hash])if(!is_file($file.'.social-pending')||is_link($file.'.social-pending')||hash_file('sha256',$file.'.social-pending')!==$hash)throw new RuntimeException('Staged module mismatch');}
    umask(0077);$db=new PDO('sqlite:'.$private.'/friends.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$db->exec('PRAGMA busy_timeout=5000');
    $hasDirectory=(bool)$db->query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='social_directory'")->fetchColumn();
    $backup=null;
    if($changed||!$hasDirectory){
        $folder=$private.'/backups';if(is_link($folder))throw new RuntimeException('Unsafe backup directory');if(!is_dir($folder)&&!mkdir($folder,0700))throw new RuntimeException('Backup directory unavailable');chmod($folder,0700);
        $backup=$folder.'/before-social-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4));if(!mkdir($backup,0700))throw new RuntimeException('Backup collision');
        // VACUUM INTO takes a consistent online snapshot; no raw copy of a live SQLite file.
        $db->exec('VACUUM INTO '.$db->quote($backup.'/friends.sqlite'));chmod($backup.'/friends.sqlite',0600);
        $copy=new PDO('sqlite:'.$backup.'/friends.sqlite');if($copy->query('PRAGMA quick_check')->fetchColumn()!=='ok')throw new RuntimeException('Backup verification failed');$copy=null;
        foreach([$core,$http] as $file){if(!copy($file,$backup.'/'.basename($file)))throw new RuntimeException('Module backup failed');chmod($backup.'/'.basename($file),0600);}
    }
    $db=null;
    if($changed){
        // HTTP whitelist first. Old core still rejects new methods until the final switch.
        if(hash_file('sha256',$http)!==$newHttp&&!rename($http.'.social-pending',$http))throw new RuntimeException('Cannot switch HTTP module');
        if(hash_file('sha256',$core)!==$newCore&&!rename($core.'.social-pending',$core))throw new RuntimeException('Cannot switch core module');
        chmod($core,0600);chmod($http,0600);
    }
    require_once $core;
    new NearbyStore($private);
    $check=new PDO('sqlite:'.$private.'/friends.sqlite');if($check->query('PRAGMA quick_check')->fetchColumn()!=='ok')throw new RuntimeException('Live SQLite check failed');
    if(!$check->query("SELECT 1 FROM sqlite_master WHERE name='social_directory' AND type='table'")->fetchColumn())throw new RuntimeException('Directory schema absent');
    return ['modules_updated'=>$changed,'backup_verified'=>$backup!==null,'backup_path'=>$backup,'database_integrity'=>'ok','config_changed'=>false];
}
if(getenv('RYADOM_SOCIAL_UPGRADE_RUN')==='1'){
 try{$result=upgrade_friends_social('/home/mewars/.ryadom-friends',[getenv('RYADOM_SOCIAL_OLD_CORE'),getenv('RYADOM_SOCIAL_OLD_HTTP'),getenv('RYADOM_SOCIAL_NEW_CORE'),getenv('RYADOM_SOCIAL_NEW_HTTP')]);echo json_encode($result,JSON_UNESCAPED_SLASHES)."\n";
  require_once '/home/mewars/.ryadom-friends/server/friends-http.php';
  $config=json_decode(file_get_contents('/home/mewars/.ryadom-friends/config.json'),true,8,JSON_THROW_ON_ERROR);
  try{nearby_authenticated_user($config,'Bearer '.str_repeat('x',64));throw new RuntimeException('Invalid identity unexpectedly accepted');}
  catch(NearbyFailure $e){if($e->httpStatus!==401){echo json_encode(['auth_status'=>$e->httpStatus,'origin_matches'=>($config['auth_origin']??'')==='https://cptbmepnbzogqkfhflsg.supabase.co','public_key_format_ok'=>is_string($config['public_key']??null)&&preg_match('/^sb_publishable_[a-zA-Z0-9_-]+$/D',$config['public_key'])===1])."\n";throw new RuntimeException('Friends Auth remains unavailable; no authentication setting was changed');}echo "Friends Auth rejects forged identity: 401\n";}
 }catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
}
