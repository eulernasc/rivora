import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/rivora/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['rivora-mark.svg', 'icon-192.svg', 'icon-512.svg', 'rivora-brand.webp'],
      manifest: {
        id: '/rivora/',
        name: 'RIVORA — Operation Automation System',
        short_name: 'RIVORA',
        description: 'Central operacional para processos, automações e rotinas.',
        lang: 'pt-BR',
        theme_color: '#050b14',
        background_color: '#050b14',
        display: 'standalone',
        display_override: ['standalone'],
        start_url: '/rivora/',
        scope: '/rivora/',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
