import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: '/settings/',
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, '../../dist/settings'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});