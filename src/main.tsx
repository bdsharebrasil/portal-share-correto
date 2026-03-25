import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/fetch-retry' // Initialize fetch retry interceptor

// Remove Service Workers corrompidos (sw.js não existe neste projeto)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      r.unregister();
      console.log('[SW] Removido:', r.scope);
    });
  });
  caches.keys().then(keys =>
    keys.forEach(k => caches.delete(k))
  );
}

createRoot(document.getElementById("root")!).render(<App />);
