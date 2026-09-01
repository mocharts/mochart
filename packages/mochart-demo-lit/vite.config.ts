import { defineConfig } from 'vite';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';

// Lit needs no compiler plugin; plain vite serves and bundles it.
export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5177 },
  preview: { port: 4177 },
  build: { sourcemap: true },
  plugins: [depSourcemaps()]
});
