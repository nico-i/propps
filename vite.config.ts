import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      // when using strategies 'injectManifest' you need to provide the srcDir
      // srcDir: 'src',
      // when using strategies 'injectManifest' use claims-sw.ts or prompt-sw.ts
      // filename: 'prompt-sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { disabled: false, config: true, htmlPreset: '2023', overrideManifestIcons: true },
      manifest: {
        name: 'Propps — filmable app stand-ins',
        short_name: 'Propps',
        description: 'Parody stand-ins for popular apps, built for filmmaking.',
        theme_color: '#0b141a',
        background_color: '#0b141a',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,svg,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,svg,ico}'],
      },
      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        /* when using generateSW the PWA plugin will switch to classic */
        type: 'module',
      },
    })
  ],
})

