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
      includeAssets: [
        'rivora-mark.svg',
        'rivora-brand.webp',
        'icon-32.png',
        'icon-180.png',
        'icon-192.png',
        'icon-512.png',
      ],
      manifest: {
        id: '/rivora/',
        name: 'RIVORA — Operation Automation System',
        short_name: 'RIVORA',
        description: 'Central operacional para processos, automações e rotinas.',
        lang: 'pt-BR',
        theme_color: '#08121e',
        background_color: '#08121e',
        display: 'standalone',
        display_override: ['standalone'],
        start_url: '/rivora/',
        scope: '/rivora/',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
