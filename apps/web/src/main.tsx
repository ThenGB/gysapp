import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installOptionalWebAnalytics } from './lib/web-analytics';
import './ui/tokens.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element missing');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    installOptionalWebAnalytics({ token: import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN });
  });
}

// PWA: register service worker hanya pada produksi (https).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // SW gagal (mis. storage penuh) — aplikasi tetap berjalan normal.
    });
  });
}
