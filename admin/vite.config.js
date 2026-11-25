import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  base: command === 'serve' && !process.env.UNIFIED ? '/' : '/admin/',
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
}));
