import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'LIFEHUB',
        short_name: 'LIFEHUB',
        description: 'Quản lý lịch, công việc và tài chính cá nhân',
        lang: 'vi',
        start_url: '/app/dashboard',
        scope: '/',
        display: 'standalone',
        theme_color: '#0B0D12',
        background_color: '#0B0D12',
        icons: [
          { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only (offline level 1). API GETs are never cached here — TanStack Query persists them (spec §6.4).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Only precache Latin + Vietnamese font subsets; the others load on demand via unicode-range.
        globIgnores: ['**/inter-{greek,greek-ext,cyrillic,cyrillic-ext}-*'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
