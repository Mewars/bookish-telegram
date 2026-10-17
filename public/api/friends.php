<?php
declare(strict_types=1);
ini_set('display_errors','0');
// The implementation and SQLite database live outside the public document root.
$local=PHP_SAPI==='cli-server'&&getenv('RYADOM_FRIENDS_LOCAL_E2E')==='1';
$module=$local?getenv('RYADOM_FRIENDS_HTTP_MODULE'):'/home/mewars/.ryadom-friends/server/friends-http.php';
if(!$module||!is_file($module)){
    http_response_code(503);header('Content-Type: application/json');header('Cache-Control: no-store');
    echo '{"data":null,"error":{"code":"unavailable"}}';exit;
}
require $module;
nearby_http();
