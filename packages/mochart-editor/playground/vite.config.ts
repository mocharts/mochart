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
  // its own port, so it runs beside the showcase (5182) and the galleries
  server: {
    port: 5183
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  }
});
