import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/opensky-network\.org\/api.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'opensky-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /^https:\/\/api\.openweathermap\.org\/data\/2\.5.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 15 // 15 minutes
              },
              networkTimeoutSeconds: 5
            }
          }
        ]
      },
      manifest: {
        name: 'ONDAGO - Travel Companion',
        short_name: 'ONDAGO',
        description: 'A secure, parent-centric travel companion with live flight tracking, packing checklists, and AI assistance.',
        theme_color: '#0d9488',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'assets/Image/ODG_logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/Image/ODG_logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
      })
    ],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://127.0.0.1:5001/flybabyfly/us-central1/api',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
});
