import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { depSourcemaps } from '../../../scripts/dep-sourcemaps.mts';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [depSourcemaps()],
  resolve: {
    alias: [
      {
        find: /^@mochart\/core$/,
        replacement: fileURLToPath(new URL('../../mochart/src/index.ts', import.meta.url))
      },
      {
        find: /^@mochart\/editor$/,
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url))
      }
    ]
  },
  server: {
    port: 5182
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
});
