import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// PWA registration - only if available
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app continues to work
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
