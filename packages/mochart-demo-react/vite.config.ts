import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5174 },
  preview: { port: 4174 },
  build: { sourcemap: true },
  plugins: [react(), depSourcemaps()]
});
