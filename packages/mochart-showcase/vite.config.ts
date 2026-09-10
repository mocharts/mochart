import { defineConfig } from 'vite';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5182 },
  preview: { port: 4182 }
});
