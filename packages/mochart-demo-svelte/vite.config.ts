import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5175 },
  preview: { port: 4175 },
  build: { sourcemap: true },
  plugins: [svelte(), depSourcemaps()]
});
