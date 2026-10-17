<?php
declare(strict_types=1);

final class NearbyFailure extends RuntimeException {
    public int $httpStatus;
    public string $errorCode;
    public function __construct(string $code, int $status=400) {
        parent::__construct('Friends request could not be completed');
        $this->errorCode=$code; $this->httpStatus=$status;
    }
}

// This file and the database are installed OUTSIDE public_html.
final class NearbyStore {
    private PDO $db;
    public function __construct(string $directory) {
        if (!is_dir($directory) || is_link($directory) || is_link($directory.'/friends.sqlite')) throw new RuntimeException('Private storage unavailable');
        umask(0077);
        $this->db=new PDO('sqlite:'.$directory.'/friends.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        chmod($directory.'/friends.sqlite',0600);
        $this->db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;');
        $this->db->exec('CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT \'Друг\',invite_code TEXT UNIQUE,invite_expires INTEGER,
          requests_started INTEGER NOT NULL,requests_count INTEGER NOT NULL DEFAULT 0,location_token TEXT,token_expires INTEGER,consent_version TEXT);
          CREATE TABLE IF NOT EXISTS friendships (
          first_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,second_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,
          requester_id TEXT NOT NULL,accepted INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,
          PRIMARY KEY(first_id,second_id),CHECK(first_id<second_id),CHECK(requester_id IN(first_id,second_id)));
          CREATE INDEX IF NOT EXISTS friendships_second ON friendships(second_id);
          CREATE TABLE IF NOT EXISTS blocks (
          blocker_id TEXT REFERENCES profiles(user_id) ON DELETE CASCADE,blocked_id TEXT NOT NULL,
          PRIMARY KEY(blocker_id,blocked_id),CHECK(blocker_id<>blocked_id));
          CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked_id);
          CREATE TABLE IF NOT EXISTS locations (
          user_id TEXT PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
          longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),updated_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
          CREATE INDEX IF NOT EXISTS locations_expiry ON locations(expires_at);
          CREATE TABLE IF NOT EXISTS request_limits(user_id TEXT PRIMARY KEY,started INTEGER NOT NULL,requests INTEGER NOT NULL,invite_started INTEGER NOT NULL,invite_requests INTEGER NOT NULL);');
    }
    private function query(string $sql,array $params=[]): PDOStatement {
        $stmt=$this->db->prepare($sql); $stmt->execute($params); return $stmt;
    }
    private function profile(string $uid,int $now): void {
        $this->query('INSERT OR IGNORE INTO profiles(user_id,requests_started) VALUES(?,?)',[$uid,$now]);
    }
    public function cleanup(int $now): void {
        $this->query('DELETE FROM locations WHERE expires_at<=?',[$now]);
        $this->query('UPDATE profiles SET location_token=NULL,token_expires=NULL WHERE token_expires<=?',[$now]);
        $this->query('UPDATE profiles SET invite_code=NULL,invite_expires=NULL WHERE invite_expires<=?',[$now]);
        $this->query('DELETE FROM request_limits WHERE started<? AND invite_started<?',[$now-86400,$now-86400]);
    }
    private static function iso($value): ?string {return $value===null?null:gmdate('Y-m-d\TH:i:s\Z',(int)$value);}
    private static function uuid($value): string {
        if (!is_string($value)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$value)) throw new NearbyFailure('42501',403);
        return $value;
    }
    private static function name($value): string {
        if(!is_string($value)||!preg_match('//u',$value)||preg_match('/[\x00-\x1f\x7f]/u',$value)) throw new NearbyFailure('22023');
        $value=trim($value); $length=preg_match_all('/./us',$value);
        if($length<2||$length>40) throw new NearbyFailure('22023');
        return $value;
    }
    private function blocked(string $u,string $p): bool {
        return (bool)$this->query('SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',[$u,$p,$p,$u])->fetchColumn();
    }
    private function rate(string $uid,int $now): void {
        // Commit limits separately so rejected invitation guesses consume the limit too.
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $row=$this->query('SELECT * FROM request_limits WHERE user_id=?',[$uid])->fetch();
            if($row&&$row['started']>$now-60&&$row['requests']>=60) throw new NearbyFailure('42900',429);
            if(!$row||$row['started']<=$now-60) $this->query('INSERT INTO request_limits VALUES(?,?,1,?,0) ON CONFLICT(user_id) DO UPDATE SET started=excluded.started,requests=1',[$uid,$now,$now]);
            else $this->query('UPDATE request_limits SET requests=requests+1 WHERE user_id=?',[$uid]);
            $this->db->exec('COMMIT');
        } catch(Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    public function call(string $uid,string $method,array $p=[],?int $now=null) {
        $uid=self::uuid($uid); $now=$now??time();
        $this->rate($uid,$now);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $this->cleanup($now);
            $result=$this->dispatch($uid,$method,$p,$now);
            $this->db->exec('COMMIT'); return $result;
        } catch(Throwable $e){$this->db->exec('ROLLBACK');throw $e;}
    }
    private function dispatch(string $u,string $method,array $p,int $now) {
        if($method==='nearby_state') {
            $self=$this->query('SELECT p.*,l.latitude,l.longitude,l.expires_at FROM profiles p LEFT JOIN locations l ON l.user_id=p.user_id AND l.expires_at>? WHERE p.user_id=?',[$now,$u])->fetch()?:[];
            $friends=$this->query('SELECT p.user_id AS id,p.display_name AS name,f.accepted,f.requester_id,l.latitude,l.longitude,l.updated_at,l.expires_at
              FROM friendships f JOIN profiles p ON p.user_id=CASE WHEN f.first_id=:u THEN f.second_id ELSE f.first_id END
              LEFT JOIN locations l ON l.user_id=p.user_id AND f.accepted=1 AND l.expires_at>:now
              WHERE (f.first_id=:u OR f.second_id=:u) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=:u AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=:u)) ORDER BY f.created_at',['u'=>$u,'now'=>$now])->fetchAll();
            foreach($friends as &$f){$f['accepted']=(bool)$f['accepted'];$f['incoming']=$f['requester_id']!==$u;unset($f['requester_id']);$f['updated_at']=self::iso($f['updated_at']);$f['expires_at']=self::iso($f['expires_at']);}
            unset($f);
            return ['self'=>['display_name'=>$self['display_name']??'Друг','invite_code'=>$self['invite_code']??null,'invite_expires'=>self::iso($self['invite_expires']??null),'latitude'=>$self['latitude']??null,'longitude'=>$self['longitude']??null,'expires_at'=>self::iso($self['expires_at']??null)],
              'friends'=>$friends,'blocked'=>$this->query('SELECT b.blocked_id AS id,coalesce(p.display_name,\'Пользователь\') AS name FROM blocks b LEFT JOIN profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=?',[$u])->fetchAll()];
        }
        if($method==='nearby_invite') {
            $name=self::name($p['p_name']??null); $this->profile($u,$now); $code=bin2hex(random_bytes(16));
            $this->query('UPDATE profiles SET display_name=?,invite_code=?,invite_expires=? WHERE user_id=?',[$name,$code,$now+86400,$u]);return $code;
        }
        if($method==='nearby_request') {
            $name=self::name($p['p_name']??null); $code=$p['p_code']??null;
            if(!is_string($code)||!preg_match('/^[a-f0-9]{32}$/Di',trim($code))) throw new NearbyFailure('42501',403);
            $peer=$this->query('SELECT user_id FROM profiles WHERE invite_code=? AND invite_expires>?',[strtolower(trim($code)),$now])->fetchColumn();
            if(!$peer||$peer===$u||$this->blocked($u,$peer)) throw new NearbyFailure('42501',403);
            $this->profile($u,$now);$this->query('UPDATE profiles SET display_name=? WHERE user_id=?',[$name,$u]);
            $a=min($u,$peer);$b=max($u,$peer);
            if($this->query('SELECT 1 FROM friendships WHERE first_id=? AND second_id=?',[$a,$b])->fetchColumn())return null;
            $profile=$this->query('SELECT invite_started,invite_requests FROM request_limits WHERE user_id=?',[$u])->fetch();
            if($profile['invite_started']<=$now-86400)$this->query('UPDATE request_limits SET invite_started=?,invite_requests=0 WHERE user_id=?',[$now,$u]);
            elseif($profile['invite_requests']>=10)throw new NearbyFailure('54000',429);
            $this->query('UPDATE request_limits SET invite_requests=invite_requests+1 WHERE user_id=?',[$u]);
            $this->query('INSERT INTO friendships VALUES(?,?,?,0,?)',[$a,$b,$u,$now]);return null;
        }
        if($method==='nearby_respond'||$method==='nearby_disconnect') {
            $peer=self::uuid($p['p_peer']??null);if($peer===$u)throw new NearbyFailure('42501',403);
            $a=min($u,$peer);$b=max($u,$peer);
            if($method==='nearby_respond') {
                if(!is_bool($p['p_accept']??null))throw new NearbyFailure('22023');
                $sql=$p['p_accept']?'UPDATE friendships SET accepted=1':'DELETE FROM friendships';
                $row=$this->query($sql.' WHERE first_id=? AND second_id=? AND requester_id<>? AND accepted=0',[$a,$b,$u]);
                if(!$row->rowCount())throw new NearbyFailure('42501',403);
            } else {
                if(!is_bool($p['p_block']??null))throw new NearbyFailure('22023');
                if($p['p_block']&&!$this->query('SELECT 1 FROM friendships WHERE first_id=? AND second_id=?',[$a,$b])->fetchColumn()&&!$this->query('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?',[$u,$peer])->fetchColumn())throw new NearbyFailure('42501',403);
                $this->query('DELETE FROM friendships WHERE first_id=? AND second_id=?',[$a,$b]);
                if($p['p_block'])$this->query('INSERT OR IGNORE INTO blocks VALUES(?,?)',[$u,$peer]);
                else $this->query('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?',[$u,$peer]);
            }return null;
        }
        if($method==='nearby_start_sharing') {
            if(($p['p_consent_version']??null)!=='FRIENDS-GEO-1.0')throw new NearbyFailure('22023');
            $this->profile($u,$now);$token=bin2hex(random_bytes(16));
            $this->query('UPDATE profiles SET location_token=?,token_expires=?,consent_version=? WHERE user_id=?',[$token,$now+600,'FRIENDS-GEO-1.0',$u]);
            $this->query('DELETE FROM locations WHERE user_id=?',[$u]);return $token;
        }
        if($method==='nearby_share') {
            $lat=$p['p_lat']??null;$lon=$p['p_lon']??null;
            foreach([$lat,$lon] as $n)if((!is_float($n)&&!is_int($n))||!is_finite((float)$n))throw new NearbyFailure('22023');
            if(abs($lat)>90||abs($lon)>180)throw new NearbyFailure('22023');
            $profile=$this->query('SELECT location_token,token_expires,consent_version FROM profiles WHERE user_id=?',[$u])->fetch();
            if(!$profile||!is_string($p['p_token']??null)||!is_string($profile['location_token'])||!hash_equals($profile['location_token'],$p['p_token'])||$profile['token_expires']<=$now||$profile['consent_version']!=='FRIENDS-GEO-1.0')throw new NearbyFailure('42501',403);
            $this->query('INSERT INTO locations VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,updated_at=excluded.updated_at,expires_at=excluded.expires_at',[$u,round($lat,2),round($lon,2),$now,$now+3600]);
            $this->query('UPDATE profiles SET location_token=NULL,token_expires=NULL WHERE user_id=?',[$u]);return null;
        }
        if($method==='nearby_hide') {
            $this->query('UPDATE profiles SET location_token=NULL,token_expires=NULL WHERE user_id=?',[$u]);
            $this->query('DELETE FROM locations WHERE user_id=?',[$u]);return null;
        }
        if($method==='nearby_forget') {
            $this->query('DELETE FROM profiles WHERE user_id=?',[$u]);return null;
        }
        throw new NearbyFailure('22023');
    }
}
