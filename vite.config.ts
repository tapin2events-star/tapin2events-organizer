import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
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
