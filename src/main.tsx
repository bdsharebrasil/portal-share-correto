import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/fetch-retry' // Initialize fetch retry interceptor

// Register service worker for PWA (offline support)
if ('serviceWorker' in navigator) {
  // Only register in production or after build
  if (!import.meta.env.DEV) {
    navigator.serviceWorker.register(new URL('./registerSW.js', import.meta.url), {
      scope: '/',
    }).then(reg => {
      console.log('[PWA] Service Worker registered successfully');

      // Listen for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[PWA] New version available, please reload');
              // Optional: Show update notification
              window.dispatchEvent(new Event('pwa-update'));
            }
          });
        }
      });
    }).catch(err => {
      console.error('[PWA] Service Worker registration failed:', err);
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
