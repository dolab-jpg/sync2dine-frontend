import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { aiProxyPlugin } from './vite.ai-plugin'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Surface VITE_API_BASE_URL from .env/.env.local to the proxy plugin, which reads
  // process.env at startup. Server-only secrets (OpenAI, Stripe, WhatsApp, JWT, …)
  // now live in tradepro-backend/.env — the embedded server/ middleware is gone.
  const env = loadEnv(mode, __dirname, '')
  if (env.VITE_API_BASE_URL && !process.env.VITE_API_BASE_URL) {
    process.env.VITE_API_BASE_URL = env.VITE_API_BASE_URL
  }

  return {
    plugins: [
      figmaAssetResolver(),
      react(),
      tailwindcss(),
      aiProxyPlugin(),
    ],
    server: {
      // Fixed port so localStorage (saved API keys, customers, quotes) persists across restarts.
      port: 5174,
      strictPort: true,
    },
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
