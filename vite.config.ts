import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente do .env
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_BACKEND_URL || 'https://api.share-brasil.com';

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        // Disable Vite's dev overlay which can fail when serializing certain DOM nodes
        overlay: false,
        protocol: 'wss',
        host: undefined,
        port: undefined,
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
      {
        name: 'add-permissions-policy',
        configureServer(server: any) {
          return () => {
            server.middlewares.use((req: any, res: any, next: any) => {
              res.setHeader('Permissions-Policy', 'geolocation=*');
              next();
            });
          };
        },
      },
    ].filter(Boolean),
    assetsInclude: ['**/*.lottie'],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    build: {
      // Otimizar tamanho do chunk
      chunkSizeWarningLimit: 1000,
    },
  };
});
