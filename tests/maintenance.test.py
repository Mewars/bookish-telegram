"""Maintenance release and actual Apache routing, including reversible reopening."""
import importlib.util
import json
import os
from pathlib import Path
import pwd
import grp
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('maintenance', ROOT / 'scripts/prepare-maintenance.py')
maintenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maintenance)


class MaintenanceTest(unittest.TestCase):
    def test_flag_rules_and_extension_recovery(self):
        self.assertTrue(maintenance.enabled('{"enabled":true}'))
        self.assertFalse(maintenance.enabled('{"enabled":false}'))
        for value in ['{}', '{"enabled":"false"}', '{"enabled":1}', 'null']:
            with self.assertRaises(ValueError):
                maintenance.enabled(value)
        original = '# Existing host rule\nErrorDocument 404 /index.html\n'
        gated = maintenance.configure_htaccess(original, True)
        self.assertEqual(maintenance.configure_htaccess(gated, True), gated)
        self.assertEqual(maintenance.configure_htaccess(gated, False), original)
        with self.assertRaises(ValueError):
            maintenance.configure_htaccess(maintenance.START, False)
        with tempfile.TemporaryDirectory() as folder:
            dist = Path(folder)
            shutil.copytree(ROOT / 'public/maintenance', dist / 'maintenance')
            (dist / 'maintenance/config.json').write_text('{"enabled":true}')
            (dist / 'version.json').write_text('{"version":"test-123456"}')
            entry = '<head><script type="module" src="/assets/app.js"></script><script src="/ui/site-shell.js"></script><script src="/classifieds/nav.js"></script></head><body>APP</body>'
            (dist / 'index.html').write_text(entry)
            (dist / 'wall').mkdir()
            (dist / 'wall/index.html').write_text('WALL')
            (dist / 'live.htaccess').write_text(original)
            maintenance.prepare(dist, dist / 'live.htaccess', dist / '.htaccess', True)
            result = (dist / 'index.html').read_text()
            self.assertIn('ryadom-preserved-host-extensions', result)
            self.assertNotIn('/assets/app.js', result)
            self.assertNotIn('supabase', result)
            self.assertNotIn('fetch(', result)
            self.assertIn('ryadom-maintenance', (dist / 'wall/index.html').read_text())
            restored = maintenance.runpy.run_path(str(ROOT / 'scripts/preserve-host-extensions.py'))['preserve'](result, '<head></head>')
            self.assertIn('/classifieds/nav.js', restored)
            self.assertIn('/ui/site-shell.js', restored)

    def test_apache_gate_and_reopening(self):
        apache = shutil.which('apache2')
        if not apache:
            if os.environ.get('REQUIRE_APACHE') == '1':
                self.fail('Apache routing test is required in CI')
            self.skipTest('Apache is not installed locally; CI requires the routing check')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            root.chmod(0o755)
            doc = root / 'www'
            doc.mkdir()
            shutil.copytree(ROOT / 'public/maintenance', doc / 'maintenance')
            (doc / 'maintenance/config.json').write_text('{"enabled":true}')
            for target, source in [('brand/ryadom-logo-transparent.png', 'public/brand/ryadom-logo-transparent.png'), ('brand/ryadom-logo-winter.svg', 'public/brand/ryadom-logo-winter.svg'), ('wall/stickers/sable-20.webp', 'host-public/wall/stickers/sable-20.webp')]:
                (doc / target).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / source, doc / target)
            for path in ['index.html','wall/index.html','classifieds/index.html','stories-preview/index.html','api/friends.php','api/weather.php','assets/app.js']:
                (doc / path).parent.mkdir(parents=True, exist_ok=True)
                (doc / path).write_text('APP')
            (doc / 'version.json').write_text('{"version":"test-123456"}')
            live = root / 'live.htaccess'
            live.write_text('# Existing host configuration\n')
            maintenance.prepare(doc, live, doc / '.htaccess')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            modules = '/usr/lib/apache2/modules'
            user = 'www-data' if os.getuid() == 0 else pwd.getpwuid(os.getuid()).pw_name
            group = 'www-data' if os.getuid() == 0 else grp.getgrgid(os.getgid()).gr_name
            config = root / 'httpd.conf'
            config.write_text(f'''ServerRoot "/etc/apache2"
ServerName localhost
Listen 127.0.0.1:{port}
PidFile "{root}/httpd.pid"
ErrorLog "{root}/error.log"
LoadModule mpm_event_module {modules}/mod_mpm_event.so
LoadModule authz_core_module {modules}/mod_authz_core.so
LoadModule mime_module {modules}/mod_mime.so
LoadModule dir_module {modules}/mod_dir.so
LoadModule rewrite_module {modules}/mod_rewrite.so
LoadModule headers_module {modules}/mod_headers.so
TypesConfig /etc/mime.types
User {user}
Group {group}
DocumentRoot "{doc}"
DirectoryIndex index.html
<Directory "{doc}">
  AllowOverride All
  Require all granted
</Directory>
''')
            process = subprocess.Popen([apache, '-f', str(config), '-DFOREGROUND'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            def request(path, method='GET'):
                try:
                    response = urlopen(Request(f'http://127.0.0.1:{port}'+path, method=method, data=b'{}' if method == 'POST' else None), timeout=5)
                except HTTPError as error:
                    response = error
                with response:
                    return response.status, response.headers, response.read().decode('utf-8', errors='replace')
            try:
                for attempt in range(40):
                    if process.poll() is not None:
                        self.fail(process.stderr.read().decode())
                    try:
                        request('/version.json')
                        break
                    except OSError:
                        time.sleep(.1)
                for path in ['/', '/index.html', '/wall/', '/wall/index.html', '/classifieds/?view=new', '/stories-preview/', '/api/friends.php?health=1', '/api/weather.php', '/assets/app.js', '/missing', '/wall//']:
                    status, headers, body = request(path)
                    self.assertEqual(status, 503, path)
                    self.assertIn('ryadom-maintenance', body, path)
                    self.assertIn('no-store', headers.get('Cache-Control', ''))
                    self.assertEqual(headers.get('Retry-After'), '3600')
                self.assertEqual(request('/api/friends.php', 'POST')[0], 503)
                self.assertEqual(request('/wall/', 'HEAD')[0], 503)
                for path in ['/brand/ryadom-logo-transparent.png','/brand/ryadom-logo-winter.svg','/wall/stickers/sable-20.webp','/maintenance/config.json','/version.json']:
                    self.assertEqual(request(path)[0], 200, path)
                (doc / 'maintenance/config.json').write_text('{"enabled":false}')
                (doc / 'index.html').write_text('REBUILT APP')
                maintenance.prepare(doc, doc / '.htaccess', doc / '.htaccess')
                self.assertEqual(request('/')[0], 200)
                self.assertEqual(request('/')[2], 'REBUILT APP')
                self.assertEqual(request('/api/friends.php')[0], 200)
            finally:
                process.terminate()
                process.wait(timeout=5)
                process.stderr.close()


if __name__ == '__main__':
    unittest.main()
