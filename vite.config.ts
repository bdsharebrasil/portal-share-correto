import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execSync } from "child_process";

// Hook para copiar o PDF worker antes de qualquer coisa
function ensurePDFWorker() {
  return {
    name: 'ensure-pdf-worker',
    apply: 'serve' as const,
    configResolved() {
      try {
        execSync('node scripts/copy-pdf-worker.js', { stdio: 'inherit' });
      } catch (err) {
        console.warn('⚠️  Falha ao copiar PDF worker, continuando com CDN fallback');
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    ensurePDFWorker(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
