import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Supabase REST/Storage paths the service worker may cache (ARCHITECTURE §8). Auth and writes never are.
const PUBLIC_CARDS = /\/rest\/v1\/published_cards(\?|$)/;
const PUBLIC_IMAGES = /\/storage\/v1\/object\/public\/(avatars|project-covers)\//;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'PIP-Hall',
        short_name: 'PIP-Hall',
        description: 'People, Identity & Projects Hall. Where every person has a place.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // color.bezel and color.bg (docs/design/tokens.json)
        theme_color: '#4E475D',
        background_color: '#F0ECEB',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell plus the Latin font files; other scripts' fonts load on demand.
        globPatterns: ['**/*.{js,css,html,svg,png}', 'assets/*-latin-[0-9]*-normal-*.woff2'],
        // The badge drawer (satori, D-104) loads only when someone saves a badge: not in the install.
        globIgnores: ['**/assets/standalone-*.js', '**/assets/badgeExportService-*.js'],
        navigateFallback: '/index.html',
        // Server routes (D-095) must reach the network, never the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Network first, so an approved card shows at once; the copy is the offline fallback.
            urlPattern: ({ url, request }) => request.method === 'GET' && PUBLIC_CARDS.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'public-cards',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Every upload gets a new file name (D-027), so a cached image never goes stale.
            urlPattern: ({ url, request }) => request.method === 'GET' && PUBLIC_IMAGES.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    environment: 'node',
  },
});
