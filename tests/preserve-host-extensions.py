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
        <script src="https://example.org/x.js"></script>
        <link rel="stylesheet" href="/categories/panel.css?v=1">
        <meta name="apple-mobile-web-app-title" content="РЯДОМ"></head>'''
        built='<head><script type="module" src="/assets/index-new.js"></script><meta name="ryadom-build-version" content="new"></head>'
        result=module.preserve(live,built)
        self.assertIn('index-new.js',result)
        self.assertIn('/categories/panel.css?v=1',result)
        self.assertIn('apple-mobile-web-app-title',result)
        for excluded in ['index-old.js','unsafe()','onload','example.org']:
            self.assertNotIn(excluded,result)
        self.assertEqual(result,module.preserve(live,result))
    def test_missing_live_extensions_cancel_publication(self):
        with self.assertRaises(ValueError):module.preserve('<head></head>','<head></head>')

unittest.main()
