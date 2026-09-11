import { defineConfig } from 'vite';
import { socialTags } from '../../scripts/social-tags.mts';

// Link preview text for the deployed page; the shared plugin takes the rest from <title>.
const description = 'A mobile-first tour of the mochart charting library: every feature has a deep-linkable page with a live config editor.';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5182 },
  preview: { port: 4182 },
  plugins: [socialTags(description)]
});
