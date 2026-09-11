import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';
import { socialTags } from '../../scripts/social-tags.mts';

// Link preview text for the deployed page; the shared plugin takes the rest from <title>.
const description = 'The mochart demo gallery built on @mochart/svelte: every demo chart in single, multi and random modes, with live config and data editing.';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5175 },
  preview: { port: 4175 },
  build: { sourcemap: true },
  plugins: [svelte(), depSourcemaps(), socialTags(description)]
});
