import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    proxy: {
      // BFF lokal: jalankan `pnpm --filter @gysapp/edge dev` (wrangler dev -p 8787)
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
