import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  publicDir: 'fixtures',
  resolve: {
    alias: {
      '@': resolve(root, '../../src'),
    },
  },
  server: {
    port: 5190,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
});
