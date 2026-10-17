<?php
// Read-only capability probe. Never reads application data or credentials.
$result = [
    'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
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
        curl_exec($curl);
        $result['auth_http_status']=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
        $result['auth_curl_errno']=curl_errno($curl);
    }
}
echo json_encode($result, JSON_UNESCAPED_SLASHES) . "\n";
