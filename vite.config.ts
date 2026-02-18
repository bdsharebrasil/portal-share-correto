import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Usar variável de ambiente para URL da API, com fallback
  const apiBaseUrl = process.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'pdf': ['pdfjs-dist'],
            'react-pdf': ['react-pdf', '@react-pdf/renderer'],
            'vendor': ['react', 'react-dom', 'react-router-dom'],
          }
        }
      }
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        // Disable Vite's dev overlay which can fail when serializing certain DOM nodes
        overlay: false,
      },
      middlewareMode: false,
      proxy: {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      {
        name: 'add-permissions-policy',
        configureServer(server: any) {
          return () => {
            server.middlewares.use((req: any, res: any, next: any) => {
              res.setHeader('Permissions-Policy', 'geolocation=*');
              res.setHeader('Feature-Policy', 'geolocation *');
              next();
            });
          };
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
