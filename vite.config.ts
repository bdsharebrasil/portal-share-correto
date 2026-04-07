import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
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
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.share.png', 'icon-512.png'],
        manifest: {
          name: 'Gestão Share Brasil',
          short_name: 'Share Brasil',
          description: 'Portal Share Brasil',
          theme_color: '#061223',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'favicon.ico',
              sizes: 'any',
              type: 'image/x-icon',
            },
            {
              src: 'logo.share.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            // API calls - NetworkFirst strategy
            {
              urlPattern: /^https:\/\/api\.share-brasil\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                cacheableResponse: {
                  statuses: [200],
                },
                networkTimeoutSeconds: 10,
              },
            },
            // Images - StaleWhileRevalidate strategy
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'image-cache',
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            // HTML - NetworkFirst strategy
            {
              urlPattern: /\.html$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-cache',
                networkTimeoutSeconds: 10,
              },
            },
            // Supabase auth - NetworkOnly (always fresh)
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
              options: {
                cacheName: 'supabase-auth',
              },
            },
          ],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
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
