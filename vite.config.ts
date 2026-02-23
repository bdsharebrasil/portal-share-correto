import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Custom plugin para lidar com pdfjs-dist
const pdfJsPlugin = {
  name: 'handle-pdfjs-dist',
  resolveId(id: string) {
    if (id === 'pdfjs-dist') {
      return {
        id: 'pdfjs-dist',
        external: true,
        moduleSideEffects: false
      };
    }
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Usar variável de ambiente para URL da API, com fallback
  const apiBaseUrl = process.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

  return {
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
      pdfJsPlugin,
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
    build: {
      rollupOptions: {
        external: ['pdfjs-dist'],
        output: {
          globals: {
            'pdfjs-dist': 'pdfjsLib'
          }
        }
      },
      // Otimizar tamanho do chunk
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
  };
});