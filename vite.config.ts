import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// A unique id for every build. The app compares it with /version.json to know when a newer TapIN is live.
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const versionFile = (): Plugin => ({
  name: 'tapin-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), versionFile()],
  define: { __TAPIN_BUILD__: JSON.stringify(BUILD_ID) },
  build: {
    rollupOptions: {
      output: {
        // Shared libraries in their own files, so phones keep them cached between TapIN updates.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('html5-qrcode') || id.includes('qrcode')) return 'qr';
          if (id.includes('hls.js')) return 'video';
          return undefined;
        },
      },
    },
  },
})
