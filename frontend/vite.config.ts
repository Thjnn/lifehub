/// <reference types="vitest/config" />
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
      // Our own service worker (src/sw.ts) so it can show deadline reminders (Web Push, spec §15.2).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
      injectManifest: {
        // App shell only (offline level 1). API GETs are never cached — TanStack Query persists them (spec §6.4).
        // Navigation fallback (index.html, never /api) lives in src/sw.ts.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Only precache Latin + Vietnamese font subsets; the others load on demand via unicode-range.
        globIgnores: ['**/inter-{greek,greek-ext,cyrillic,cyrillic-ext}-*'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // jsdom has no IndexedDB; Dexie (offline outbox) needs one
    setupFiles: ['fake-indexeddb/auto'],
  },
})
