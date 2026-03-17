import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // this manifest is what tells android how the app should look on the home screen
      manifest: {
        name: 'Practice Player',
        short_name: 'Practice',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone', // hides the browser url bar
        icons: [
          // you will need to generate and drop these icons into your public/ folder later
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})