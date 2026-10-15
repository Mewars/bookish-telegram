import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isClosedBeta = mode === 'closed-beta';
  // This is a second fail-closed check even when Vite is run without npm's beta wrapper.
  if (isClosedBeta) {
    const env = loadEnv(mode, '.', '');
    if (env.CONTEXT !== 'closed-beta' ||
        env.VITE_SUPABASE_URL !== 'https://djqhixvlfsbvannoqdjw.supabase.co' ||
        !/^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY || '')) {
      throw new Error('Refusing closed-beta build with unsafe backend or credentials');
    }
    const required: Record<string, string> = {
      VITE_CLASSIFIEDS_ENABLED: 'true',
      VITE_COMMUNITY_ENABLED: 'true',
      VITE_BETA_EMAIL_ONLY: 'true',
      VITE_VK_ID_ENABLED: 'false',
      VITE_ADMIN_PANEL_ENABLED: 'false',
      VITE_CARD_PHOTOS_ENABLED: 'false',
      VITE_CITY_DIRECTORY_ENABLED: 'false',
      VITE_ORGANIZATIONS_ENABLED: 'false',
    };
    for (const [name, expected] of Object.entries(required)) {
      if (env[name] !== expected) throw new Error(`Unsafe closed-beta feature flag: ${name}`);
    }
  }
  // The HTML meta and the public version endpoint MUST share the same build ID.
  const deployEnv = loadEnv(mode, '.', ['GITHUB_SHA', 'COMMIT_REF']);
  const buildId = deployEnv.GITHUB_SHA || deployEnv.COMMIT_REF || `local-${Date.now()}`;
  return {
    base: mode === 'github-pages-test' ? '/bookish-telegram/' : '/',
    plugins: [
      react(),
      {
        name: 'ryadom-release-version',
        transformIndexHtml(html) {
          return html.replace('</head>', `<meta name="ryadom-build-version" content="${buildId}"/></head>`);
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: buildId }) + '\n',
          });
        },
      },
      {
        name: 'ryadom-closed-beta-noindex',
        transformIndexHtml(html) {
          if (!isClosedBeta) return html;
          return html
            .replace(/\s*<link rel="canonical"[^>]*\/>/, '')
            .replace(/\s*<meta property="og:url"[^>]*\/>/, '')
            .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
            .replace('</head>',
              '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet"/>' +
              '<meta name="referrer" content="no-referrer"/></head>');
        },
      },
      {
        name: 'production-metrika-noscript',
        // Without JavaScript, hostname checks are impossible. Keep the pixel only
        // in production deployments, never dev/preview/local builds.
        transformIndexHtml(html) {
          return loadEnv(mode, '.', 'CONTEXT').CONTEXT === 'production'
            ? html
            : html.replace(/\s*<!-- metrika-noscript-start -->[\s\S]*?<!-- metrika-noscript-end -->/, '');
        },
      },
    ],
    build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  };
});
