<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require_once __DIR__.'/friends-core.php';
$directory=dirname(__DIR__);
if(is_file($directory.'/friends.sqlite'))(new NearbyStore($directory))->cleanup(time());
