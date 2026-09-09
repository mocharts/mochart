import { defineConfig } from 'vite';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';

// Each demo gallery pins its own port so they can run side by side.
export default defineConfig({
  server: { port: 5178 },
  preview: { port: 4178 },
  build: { sourcemap: true },
  plugins: [depSourcemaps()]
});
