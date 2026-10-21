"""Keep existing same-origin host extensions when replacing the React entrypoint."""
import sys
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

PREFIXES = ('/ui/', '/classifieds/', '/owner/', '/reviews/', '/pwa/',
            '/categories/', '/auth/', '/profile/', '/admin/', '/notifications/')


class Extensions(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.paths = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'meta' and attrs.get('name') in ('apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title', 'mobile-web-app-capable'):
            self.tags.append('<meta name="'+escape(attrs['name'], quote=True)+'" content="'+escape(attrs.get('content', ''), quote=True)+'">')
            return
        value = attrs.get('src') if tag == 'script' else attrs.get('href')
        if tag not in ('script', 'link') or not value:
            return
        url = urlsplit(value)
        if url.scheme or url.netloc or not value.startswith('/') or value.startswith('//'):
            return
        if not (url.path.startswith(PREFIXES) or url.path == '/app.webmanifest'):
            return
        if url.path in self.paths:
            return
        self.paths.add(url.path)
        if tag == 'script' and url.path == '/ui/site-shell.js':
            attrs['src'] = '/ui/site-shell.js?v=20261021music1'
        if tag == 'script' and url.path in ('/categories/panel.js','/admin/catalog.js'):
            attrs['src'] = url.path+'?v=20261021catalog1'
            attrs['type'] = 'module'
        if tag == 'link' and url.path == '/admin/catalog.css':
            attrs['href'] = '/admin/catalog.css?v=20261021catalog1'
        # Preserve only browser loading attributes, never event-handler code.
        keep = ('src', 'type', 'defer', 'async', 'crossorigin') if tag == 'script' else ('href', 'rel', 'type', 'sizes', 'crossorigin')
        safe = ' '.join(name if attrs[name] is None else name+'="'+escape(attrs[name], quote=True)+'"'
                        for name in keep if name in attrs)
        self.tags.append('<'+tag+' '+safe+'>'+('</script>' if tag == 'script' else ''))


def preserve(live, built):
    parser = Extensions()
    parser.feed(live)
    missing = [tag for tag in parser.tags if tag not in built]
    if '/classifieds/nav.js' not in parser.paths or '/ui/site-shell.js' not in parser.paths:
        raise ValueError('Expected live extensions missing; publication cancelled')
    if not missing:
        return built
    return built.replace('</head>', '\n'.join(missing)+'\n</head>')


if __name__ == '__main__':
    live, built = map(Path, sys.argv[1:3])
    built.write_text(preserve(live.read_text(), built.read_text()))
    print('Existing host extension links preserved; React bundle and release ID retained.')
