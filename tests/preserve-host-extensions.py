import importlib.util
import unittest

spec=importlib.util.spec_from_file_location('preserve','scripts/preserve-host-extensions.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Preservation(unittest.TestCase):
    def test_preserves_modules_without_old_react_assets_or_inline_handlers(self):
        live='''<head><script defer src="/ui/site-shell.js?v=1"></script>
        <script defer src="/classifieds/nav.js?v=9" onload="unsafe()"></script>
        <script type="module" src="/assets/index-old.js"></script>
        <script type="module" src="/notifications/widget.js?v=20261018d"></script>
        <script src="https://example.org/x.js"></script>
        <link rel="stylesheet" href="/categories/panel.css?v=1"><link rel="stylesheet" href="/ui/mobile-fixes.css?v=20261018d">
        <link rel="manifest" href="/app.webmanifest"><link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png"><script defer src="/pwa/register.js?v=old"></script>
        <meta name="apple-mobile-web-app-title" content="РЯДОМ"></head>'''
        built='<head><meta name="apple-mobile-web-app-title" content="Встречай"><link rel="manifest" href="/app.webmanifest"><link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png?v=vstrechay2"><script type="module" src="/assets/index-new.js"></script><meta name="ryadom-build-version" content="new"></head>'
        result=module.preserve(live,built)
        self.assertIn('index-new.js',result)
        self.assertIn('/ui/site-shell.js?v=vstrechay2',result)
        self.assertNotIn('/ui/site-shell.js?v=1\"',result)
        self.assertIn('/categories/panel.css?v=1',result)
        self.assertIn('/ui/mobile-fixes.css?v=20261101header3',result)
        self.assertNotIn('/ui/mobile-fixes.css?v=20261018d',result)
        self.assertEqual(result.count('apple-mobile-web-app-title'),1)
        self.assertIn('content="Встречай"',result)
        self.assertNotIn('РЯДОМ',result)
        self.assertNotIn('/pwa/register.js',result)
        self.assertEqual(result.count('rel="manifest"'),1)
        self.assertIn('/notifications/widget.js?v=vstrechay2',result)
        self.assertNotIn('/notifications/widget.js?v=20261018d',result)
        for excluded in ['index-old.js','unsafe()','onload','example.org']:
            self.assertNotIn(excluded,result)
        self.assertEqual(result,module.preserve(live,result))
    def test_missing_live_extensions_cancel_publication(self):
        with self.assertRaises(ValueError):module.preserve('<head></head>','<head></head>')

unittest.main()
