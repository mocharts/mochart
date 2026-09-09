import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5176 },
  preview: { port: 4176 },
  build: { sourcemap: true },
  plugins: [vue(), depSourcemaps()]
});
