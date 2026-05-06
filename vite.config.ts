import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Lemma',
        short_name: 'Lemma',
        description: 'Personal vocabulary spaced repetition',
        theme_color: '#1d3557',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/capture',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/\.netlify\//, /^\/functions\//],
      },
    }),
  ],
  server: {
    proxy: {
      '/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/functions/, '/.netlify/functions'),
      },
    },
  },
});
