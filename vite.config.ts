/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves at https://<user>.github.io/recipe_gen/
export default defineConfig({
  base: '/recipe_gen/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Recipe Gen — 節約レシピ',
        short_name: 'Recipe Gen',
        description: 'Free AI recipes from Japanese supermarket ingredients — cheap and quick.',
        theme_color: '#2f7d4a',
        background_color: '#f4f7f2',
        display: 'standalone',
        start_url: '/recipe_gen/',
        scope: '/recipe_gen/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        // Cache the rounded display font so the app looks right offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      }
    })
  ],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'api/**/*.test.ts'] }
});
