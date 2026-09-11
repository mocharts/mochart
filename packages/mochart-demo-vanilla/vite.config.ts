import { defineConfig } from 'vite';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';
import { socialTags } from '../../scripts/social-tags.mts';

// Link preview text for the deployed page; the shared plugin takes the rest from <title>.
const description = 'The mochart demo gallery built on @mochart/core with no framework: every demo chart in single, multi and random modes, with live config and data editing.';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5179 },
  preview: { port: 4179 },
  build: { sourcemap: true },
  plugins: [depSourcemaps(), socialTags(description)]
});
