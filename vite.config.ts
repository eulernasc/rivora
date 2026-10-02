import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/rivora/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['rivora-mark.svg', 'rivora-brand.webp'],
      manifest: {
        name: 'RIVORA — Operation Automation System',
        short_name: 'RIVORA',
        description: 'Central operacional para processos, automações e rotinas.',
        theme_color: '#050b14',
        background_color: '#050b14',
        display: 'standalone',
        start_url: '/rivora/',
        scope: '/rivora/',
        icons: [{ src: 'rivora-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})
