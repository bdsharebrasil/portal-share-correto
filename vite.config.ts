import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Define variáveis globais (opcional - só se necessário)
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(
        env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev'
      ),
    },

    // Configuração do servidor de desenvolvimento
    server: {
      port: 3000,
      proxy: {
        // Opcional: Proxy para desenvolvimento local
        // '/api': {
        //   target: env.VITE_BACKEND_URL || 'http://localhost:8787',
        //   changeOrigin: true,
        // },
      },
    },
  }
})