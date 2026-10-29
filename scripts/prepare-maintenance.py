"""Prepare a reversible, script-free maintenance release and preserve host rules."""
import json
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = '# BEGIN RYADOM MAINTENANCE'
END = '# END RYADOM MAINTENANCE'
BLOCK = r'''# BEGIN RYADOM MAINTENANCE
ErrorDocument 503 /maintenance/index.html
<IfModule mod_headers.c>
  Header always set Cache-Control "no-store, max-age=0, must-revalidate"
  Header always set Retry-After "3600"
</IfModule>
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/(?:maintenance/(?:index\.html|config\.json)|brand/ryadom-logo-transparent\.png|wall/stickers/sable-20\.webp|version\.json)$
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteRule ^ - [R=503,L]
# END RYADOM MAINTENANCE
'''


def enabled(config):
    value = json.loads(config)
    if not isinstance(value, dict) or type(value.get('enabled')) is not bool:
        raise ValueError('Maintenance enabled must be an explicit JSON boolean')
    return value['enabled']


def configure_htaccess(original, active):
    if original.count(START) != original.count(END) or original.count(START) > 1:
        raise ValueError('Unexpected maintenance markers; preserve host configuration')
    cleaned = re.sub(re.escape(START) + r'\n.*?' + re.escape(END) + r'\n?', '', original, flags=re.S)
    return (BLOCK if active else '') + cleaned


def prepare(dist, live_htaccess, output_htaccess, require_host_extensions=False):
    active = enabled((dist / 'maintenance/config.json').read_text())
    rewritten = configure_htaccess(live_htaccess.read_text(), active)
    if active:
        template = (dist / 'maintenance/index.html').read_text()
        version = json.loads((dist / 'version.json').read_text())['version']
        if not isinstance(version, str) or not re.fullmatch(r'[\w.-]{6,80}', version):
            raise ValueError('Invalid release version')
        template = template.replace('</head>', f'<meta name="ryadom-build-version" content="{version}">\n</head>')
        # Keep host extension tags inert so the next normal release can recover
        # the reviewed integrations via preserve-host-extensions.py, without
        # loading any of their scripts, styles or user-data requests now.
        parser = runpy.run_path(str(ROOT / 'scripts/preserve-host-extensions.py'))['Extensions']()
        parser.feed((dist / 'index.html').read_text())
        if require_host_extensions and ('/classifieds/nav.js' not in parser.paths or '/ui/site-shell.js' not in parser.paths):
            raise ValueError('Host extension metadata missing; publication cancelled')
        preserved = '<template id="ryadom-preserved-host-extensions">' + '\n'.join(parser.tags) + '</template>'
        for entry in dist.rglob('index.html'):
            html = template
            if entry == dist / 'index.html':
                html = html.replace('</body>', preserved + '\n</body>')
            entry.write_text(html)
    output_htaccess.write_text(rewritten)
    print('Maintenance release prepared.' if active else 'Normal release prepared; maintenance rules removed.')


if __name__ == '__main__':
    if len(sys.argv) not in (4, 5) or (len(sys.argv) == 5 and sys.argv[4] != '--require-host-extensions'):
        raise SystemExit('Usage: prepare-maintenance.py DIST LIVE_HTACCESS OUTPUT_HTACCESS [--require-host-extensions]')
    prepare(*map(Path, sys.argv[1:4]), require_host_extensions=len(sys.argv) == 5)
