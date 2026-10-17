#!/usr/bin/env bash
set -euo pipefail
# Uses the existing deployment identity. No database/Auth migration in Supabase.
test "$VITE_SUPABASE_URL" = 'https://cptbmepnbzogqkfhflsg.supabase.co'
[[ "$VITE_SUPABASE_PUBLISHABLE_KEY" =~ ^sb_publishable_[A-Za-z0-9_-]+$ ]]
echo 'Friends: public configuration validated.'
ssh_args=(-i "$HOME/.ssh/ryadom-deploy-key" -p "$SPRINTHOST_SSH_PORT" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes)
remote="$SPRINTHOST_USER@$SPRINTHOST_HOST"
ssh "${ssh_args[@]}" "$remote" 'bash -s' <<'FRIENDS_PREPARE'
set -euo pipefail
umask 077
private=/home/mewars/.ryadom-friends
test -d /home/mewars/domains/ryadomcity.ru/public_html
test ! -L "$private"
test ! -L "$private/server"
mkdir -p "$private/server"
test "$(cd "$private" && pwd -P)" = "$private"
chmod 700 "$private" "$private/server"
php -r 'exit(extension_loaded("pdo_sqlite") && extension_loaded("curl") ? 0 : 1);'
command -v crontab >/dev/null
echo 'Friends: private directory, PHP modules and cron binary checked.'
FRIENDS_PREPARE
export RSYNC_RSH="ssh -i $HOME/.ssh/ryadom-deploy-key -p $SPRINTHOST_SSH_PORT -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes"
rsync -az --chmod=D700,F600 server/ "$remote:/home/mewars/.ryadom-friends/server/"
echo 'Friends: private server modules transferred.'
node --input-type=module -e 'process.stdout.write(JSON.stringify({enabled:true,auth_origin:process.env.VITE_SUPABASE_URL,public_key:process.env.VITE_SUPABASE_PUBLISHABLE_KEY}))' |
  ssh "${ssh_args[@]}" "$remote" 'umask 077; cat > /home/mewars/.ryadom-friends/config.pending && mv /home/mewars/.ryadom-friends/config.pending /home/mewars/.ryadom-friends/config.json'
echo 'Friends: private configuration installed.'
ssh "${ssh_args[@]}" "$remote" 'bash -s' <<'FRIENDS_CRON'
set -euo pipefail
umask 077
private=/home/mewars/.ryadom-friends
php -r 'require "/home/mewars/.ryadom-friends/server/friends-http.php"; $config=json_decode(file_get_contents("/home/mewars/.ryadom-friends/config.json"),true); try {nearby_authenticated_user($config,"Bearer ".str_repeat("x",64));} catch(NearbyFailure $e) {fwrite(STDERR,"Friends Auth preflight: HTTP ".$e->httpStatus." code ".$e->errorCode."\n");exit($e->httpStatus===401?0:1);} exit(1);'
echo 'Friends: Auth connectivity checked.'
php -r 'require "/home/mewars/.ryadom-friends/server/friends-core.php"; new NearbyStore("/home/mewars/.ryadom-friends");'
echo 'Friends: private SQLite database initialized.'
php "$private/server/friends-cron.php"
echo 'Friends private storage and expiry cleanup are ready.'
FRIENDS_CRON
