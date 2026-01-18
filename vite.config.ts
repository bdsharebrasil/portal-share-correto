import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      // Disable Vite's dev overlay which can fail when serializing certain DOM nodes
      overlay: false,
      // Allow HMR to work through proxies by using the same host as the browser
      // This works with projects.builder.codes proxy
    },
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
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
}));
