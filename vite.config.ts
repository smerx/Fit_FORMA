import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { groqProxy } from './vite-groq-proxy.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    groqProxy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['remind-sw.js'],
      },
      manifest: {
        name: 'Форма',
        short_name: 'Форма',
        description: 'Дневник еды, активностей и веса',
        theme_color: '#07080b',
        background_color: '#07080b',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ru',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
