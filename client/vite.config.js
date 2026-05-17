import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
