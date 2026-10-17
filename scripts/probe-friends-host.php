<?php
// Read-only capability probe. Never reads application data or credentials.
$result = [
    'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
    'php_binary' => PHP_BINARY,
    'sqlite' => extension_loaded('pdo_sqlite'),
    'curl' => extension_loaded('curl'),
    'openssl' => extension_loaded('openssl'),
    'private_parent_writable' => is_writable('/home/mewars'),
    'production_root_exists' => is_dir('/home/mewars/domains/ryadomcity.ru/public_html'),
];
if ($result['sqlite']) {
    $db = new PDO('sqlite::memory:');
    $result['sqlite_version'] = $db->query('SELECT sqlite_version()')->fetchColumn();
}
$private='/home/mewars/.ryadom-friends';
$result['private_directory_exists']=is_dir($private);
$result['private_module_exists']=is_file($private.'/server/friends-http.php');
$result['private_config_exists']=is_file($private.'/config.json');
$result['private_database_exists']=is_file($private.'/friends.sqlite');
$result['cron_binary_exists']=is_executable('/usr/bin/crontab');
if($result['private_config_exists']&&$result['curl']){
    $config=json_decode(file_get_contents($private.'/config.json'),true);
    if(($config['auth_origin']??'')==='https://cptbmepnbzogqkfhflsg.supabase.co'){
        $curl=curl_init($config['auth_origin'].'/auth/v1/user');
        curl_setopt_array($curl,[CURLOPT_HTTPHEADER=>['apikey: '.$config['public_key'],'Authorization: Bearer '.str_repeat('x',64)],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_FOLLOWLOCATION=>false]);
        $body=curl_exec($curl);
        $result['auth_http_status']=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
        $result['auth_curl_errno']=curl_errno($curl);
        $reply=is_string($body)?json_decode($body,true):null;
        $result['auth_json_reply']=is_array($reply);
        $code=is_array($reply)?($reply['error_code']??$reply['code']??null):null;
        $result['auth_error_code']=is_string($code)&&preg_match('/^[a-z_]+$/D',$code)?$code:null;
    }
}
if(function_exists('proc_open')){
    $process=proc_open(['crontab','-l'],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(is_resource($process)){
        $cron=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
        $result['cron_list_status']=proc_close($process);
        $result['cron_own_job_present']=strpos($cron,'# RYADOM_FRIENDS_EXPIRE_V1')!==false;
        $result['cron_no_table_message']=strpos($error,'no crontab for')!==false;
    }
}
echo json_encode($result, JSON_UNESCAPED_SLASHES) . "\n";
