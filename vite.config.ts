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
        description: 'AI recipes from Japanese supermarket ingredients, on-device.',
        theme_color: '#e85d3a',
        background_color: '#fffaf5',
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
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
