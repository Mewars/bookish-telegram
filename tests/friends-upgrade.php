<?php
declare(strict_types=1);
require __DIR__.'/../scripts/upgrade-friends-social.php';
function verify(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
$root=sys_get_temp_dir().'/ryadom-social-upgrade-'.bin2hex(random_bytes(5));mkdir($root,0700);mkdir($root.'/server',0700);
function clean(string $dir):void{foreach(scandir($dir) as $name){if($name==='.'||$name==='..')continue;$file=$dir.'/'.$name;if(is_dir($file)&&!is_link($file))clean($file);else unlink($file);}rmdir($dir);}
register_shutdown_function(static fn()=>clean($root));
$db=new PDO('sqlite:'.$root.'/friends.sqlite');$db->exec("CREATE TABLE profiles(id text,name text);INSERT INTO profiles VALUES('synthetic','Private fixture');");chmod($root.'/friends.sqlite',0600);$db=null;
file_put_contents($root.'/config.json','{"private":"must remain byte-for-byte unchanged"}');chmod($root.'/config.json',0600);$configHash=hash_file('sha256',$root.'/config.json');
$oldCore='<?php // reviewed previous core';$oldHttp='<?php // reviewed previous HTTP';
$newCore= <<<'PHP'
<?php
class NearbyStore{public function __construct(string $path){$db=new PDO('sqlite:'.$path.'/friends.sqlite');$db->exec('CREATE TABLE IF NOT EXISTS social_directory(user_id text PRIMARY KEY,city text)');}}
PHP;
$newHttp='<?php // reviewed new HTTP';
$core=$root.'/server/friends-core.php';$http=$root.'/server/friends-http.php';
file_put_contents($core,$oldCore);file_put_contents($http,$oldHttp);file_put_contents($core.'.social-pending',$newCore);file_put_contents($http.'.social-pending',$newHttp);
$hashes=array_map(static fn($s)=>hash('sha256',$s),[$oldCore,$oldHttp,$newCore,$newHttp]);
file_put_contents($core,'<?php // unexpected manual patch');
try{upgrade_friends_social($root,$hashes);throw new RuntimeException('Manual change was overwritten');}catch(RuntimeException $e){verify(str_contains($e->getMessage(),'manual changes'),'Must reject unexpected host edits');}
verify(!is_dir($root.'/backups'),'Refusal must happen before backup or mutation');file_put_contents($core,$oldCore);
$result=upgrade_friends_social($root,$hashes);verify($result['backup_verified']&&$result['modules_updated'],'Must verify snapshot before upgrade');
$backup=new PDO('sqlite:'.$result['backup_path'].'/friends.sqlite');verify($backup->query('PRAGMA quick_check')->fetchColumn()==='ok','Snapshot integrity');verify($backup->query('select name from profiles')->fetchColumn()==='Private fixture','Snapshot must preserve source data');verify(!$backup->query("select 1 from sqlite_master where name='social_directory'")->fetchColumn(),'Snapshot must precede migration');$backup=null;
$live=new PDO('sqlite:'.$root.'/friends.sqlite');verify($live->query('select name from profiles')->fetchColumn()==='Private fixture','Live profile must survive');verify((bool)$live->query("select 1 from sqlite_master where name='social_directory'")->fetchColumn(),'New directory must exist');$live=null;
verify(hash_file('sha256',$root.'/config.json')===$configHash,'Cannot touch configuration');verify((fileperms($result['backup_path'].'/friends.sqlite')&0077)===0,'Snapshot must stay private');
$again=upgrade_friends_social($root,$hashes);verify(!$again['modules_updated']&&!$again['backup_verified'],'Repeated unchanged deployments must not rewrite modules or duplicate snapshots');
echo "PASS: online SQLite snapshot verified before migration; data/config preserved; manual patches refused; idempotent deployment\n";
