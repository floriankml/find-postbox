import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Absolute URL of the deployed site (with trailing slash). Social networks need
 * absolute URLs for link preview images. Falls back to relative URLs.
 */
const siteUrl = (() => {
  const u = process.env.VITE_SITE_URL?.trim()
  return u ? (u.endsWith('/') ? u : `${u}/`) : './'
})()

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Postbox Finder',
        short_name: 'Postbox',
        description: 'Find nearby post boxes – with collection times, international mail info and navigation.',
        lang: 'en',
        theme_color: '#1d4ed8',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nur die App-Shell wird vorab gecacht. Kartenkacheln und API-Antworten
        // werden bewusst NICHT vom Service Worker gecacht (OSM Tile Usage Policy);
        // Briefkastendaten werden von der App selbst in IndexedDB gehalten.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icon-*.png', 'apple-touch-icon.png'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
