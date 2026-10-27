#!/usr/bin/env bash
# Reviewed code upgrade only. Keep config, secrets, cron and user content in place.
set -euo pipefail
ssh_args=(-i "$HOME/.ssh/ryadom-deploy-key" -p "$SPRINTHOST_SSH_PORT" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes)
remote="$SPRINTHOST_USER@$SPRINTHOST_HOST"
private=/home/mewars/.ryadom-friends
ssh "${ssh_args[@]}" "$remote" 'bash -s' <<'CHECK'
set -euo pipefail
private=/home/mewars/.ryadom-friends
test -d /home/mewars/domains/ryadomcity.ru/public_html
test -d "$private/server" && test ! -L "$private" && test ! -L "$private/server"
test "$(cd "$private" && pwd -P)" = "$private"
test -f "$private/friends.sqlite" && test ! -L "$private/friends.sqlite"
test ! -L "$private/server/friends-core.php.social-pending"
test ! -L "$private/server/friends-http.php.social-pending"
CHECK
export RSYNC_RSH="ssh -i $HOME/.ssh/ryadom-deploy-key -p $SPRINTHOST_SSH_PORT -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes"
rsync -az --chmod=F600 server/friends-core.php "$remote:$private/server/friends-core.php.social-pending"
rsync -az --chmod=F600 server/friends-http.php "$remote:$private/server/friends-http.php.social-pending"
core_sha=$(sha256sum server/friends-core.php | cut -d' ' -f1)
http_sha=$(sha256sum server/friends-http.php | cut -d' ' -f1)
ssh "${ssh_args[@]}" "$remote" "RYADOM_SOCIAL_UPGRADE_RUN=1 RYADOM_SOCIAL_OLD_CORE=78a8e84afe2200d504ea96dffe4b183743c36d16be4188c1d68f854e93d15e15 RYADOM_SOCIAL_OLD_HTTP=45daf1952bb2a5368cdb6ac8fec0f7876fe53467014c9cbab8a62826c75d3aea RYADOM_SOCIAL_NEW_CORE=$core_sha RYADOM_SOCIAL_NEW_HTTP=$http_sha php" < scripts/upgrade-friends-social.php
