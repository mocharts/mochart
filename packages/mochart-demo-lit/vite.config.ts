import { defineConfig } from 'vite';
import { depSourcemaps } from '../../scripts/dep-sourcemaps.mts';
import { socialTags } from '../../scripts/social-tags.mts';

// Lit needs no compiler plugin; plain vite serves and bundles it.
// Link preview text for the deployed page; the shared plugin takes the rest from <title>.
const description = 'The mochart demo gallery built on @mochart/lit: every demo chart in single, multi and random modes, with live config and data editing.';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5177 },
  preview: { port: 4177 },
  build: { sourcemap: true },
  plugins: [depSourcemaps(), socialTags(description)]
});
