<?php
declare(strict_types=1);

function nearby_cron_contents(string $current,string $binary,string $directory): string {
    if(!preg_match('~^/[a-zA-Z0-9_./-]+$~D',$binary)||!preg_match('~^/[a-zA-Z0-9_./-]+$~D',$directory))throw new RuntimeException('Invalid cleanup executable path');
    $job='*/5 * * * * '.$binary.' '.$directory.'/server/friends-cleanup.php >/dev/null 2>&1 # RYADOM_FRIENDS_EXPIRE_V1';
    $lines=preg_split('/\r?\n/',$current);
    foreach($lines as $line)if(str_contains($line,'# RYADOM_FRIENDS_EXPIRE_V1')){
        if($line!==$job)throw new RuntimeException('Unexpected conflicting cleanup marker; existing tasks preserved');
        return $current;
    }
    return rtrim($current,"\r\n")."\n".$job."\n";
}
function nearby_crontab(array $arguments,string $input=''): array {
    $process=proc_open(array_merge(['/usr/bin/crontab'],$arguments),[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(!is_resource($process))throw new RuntimeException('Cannot start the user cron interface');
    if($input!==''){
        $offset=0;
        while($offset<strlen($input)){$written=fwrite($pipes[0],substr($input,$offset));if($written===false||$written===0)throw new RuntimeException('Cannot write the cleanup schedule');$offset+=$written;}
    }
    fclose($pipes[0]);$output=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    return [proc_close($process),$output,$error];
}
if(realpath($_SERVER['SCRIPT_FILENAME']??'')!==__FILE__)return;
if(PHP_SAPI!=='cli')exit(1);
try{
    [$status,$current,$error]=nearby_crontab(['-l']);
    if($status!==0){
        if($status!==1||stripos($error,'no crontab for')===false)throw new RuntimeException('Cannot read the existing user schedule (status '.$status.')');
        $current='';
    }
    $desired=nearby_cron_contents($current,PHP_BINARY,dirname(__DIR__));
    if($desired!==$current){[$status]=nearby_crontab(['-'],$desired);if($status!==0)throw new RuntimeException('Cannot install the cleanup schedule (status '.$status.')');}
    [$status,$saved]=nearby_crontab(['-l']);
    if($status!==0||nearby_cron_contents($saved,PHP_BINARY,dirname(__DIR__))!==$saved)throw new RuntimeException('Cleanup schedule verification failed');
    $savedLines=preg_split('/\r?\n/',$saved);
    foreach(preg_split('/\r?\n/',$current) as $line)if($line!==''&&!in_array($line,$savedLines,true))throw new RuntimeException('Existing user schedule verification failed');
    echo "Friends: expiry cleanup installed and existing jobs preserved.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
