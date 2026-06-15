import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // animate-ui ikonkalari uchun '@' → src va 'motion/react' → framer-motion
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'motion/react': 'framer-motion',
    },
  },
  server: {
    port: 5173,
    host: true,            // 0.0.0.0 — tashqi (ngrok) ulanishlari uchun
    allowedHosts: true,    // Telegram / ngrok / cloudflare hostlarini ruxsat berish
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
