import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({
  // Netlify keeps the root path; only the explicit Pages build uses the repo path.
  base: mode === 'github-pages' ? '/bookish-telegram/' : '/',
  plugins: [react(), {
    name: 'production-metrika-noscript',
    // Without JavaScript, hostname checks are impossible. Keep the pixel only
    // in Netlify production deployments, never dev/preview/local builds.
    transformIndexHtml(html) {
      return loadEnv(mode, '.', 'CONTEXT').CONTEXT === 'production' ? html : html.replace(/\s*<!-- metrika-noscript-start -->[\s\S]*?<!-- metrika-noscript-end -->/, '');
    },
  }],
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
}));
