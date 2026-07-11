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
  // Surface .env/.env.local values to the API middleware (server/ runs in this process).
  const env = loadEnv(mode, __dirname, '')
  for (const key of [
    'OPENAI_API_KEY',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'INTEGRATIONS_MOCK_MODE',
    'APP_BASE_URL',
    'WEBHOOK_BASE_URL',
    'CHATTERBOX_BASE_URL',
    'CHATTERBOX_API_KEY',
    'CHATTERBOX_TTS_PATH',
    'TELEPHONY_PROVIDER',
    'SOHO66_SIP_USERNAME',
    'SOHO66_SIP_PASSWORD',
    'SOHO66_SIP_DOMAIN',
    'SOHO66_FROM_NUMBER',
    'SOHO66_SIP_BRIDGE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_STARTER',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_ENTERPRISE',
    'JWT_SECRET',
    'ORG_ENCRYPTION_KEY',
    'AUTH_ENFORCED',
    'PLATFORM_OWNER_EMAIL',
    'PLATFORM_OWNER_PASSWORD',
    'VITE_API_BASE_URL',
  ]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
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
