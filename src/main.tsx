import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './plano-voo-mobile.css'
import './lib/fetch-retry' // Initialize fetch retry interceptor

createRoot(document.getElementById("root")!).render(<App />);
