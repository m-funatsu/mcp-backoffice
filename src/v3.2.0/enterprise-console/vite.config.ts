import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: '/enterprise-console/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/enterprise-console'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});