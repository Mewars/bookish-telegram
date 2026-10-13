import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // The HTML meta and the public version endpoint MUST share the same build ID.
  const buildId = process.env.GITHUB_SHA || process.env.COMMIT_REF || `local-${Date.now()}`;
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
