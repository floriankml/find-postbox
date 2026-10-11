import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'Postbox Finder',
        short_name: 'Postbox',
        description: 'Briefkästen in der Nähe finden – mit Versandhinweisen und Navigation.',
        lang: 'de',
        theme_color: '#1d4ed8',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nur die App-Shell wird vorab gecacht. Kartenkacheln und API-Antworten
        // werden bewusst NICHT vom Service Worker gecacht (OSM Tile Usage Policy);
        // Briefkastendaten werden von der App selbst in IndexedDB gehalten.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
