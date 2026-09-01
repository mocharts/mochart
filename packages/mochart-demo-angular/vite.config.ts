import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { depSourcemaps } from '../../scripts/dep-sourcemaps';

export default defineConfig({
  // Each demo gallery pins its own port so they can run side by side.
  server: { port: 5180 },
  preview: { port: 4180 },
  build: { sourcemap: true },
  resolve: {
    alias: {
      // Compile the binding from source together with the app: its published
      // dist ships partial-Ivy declarations, and the plugin's linker skips
      // workspace-symlinked packages (they resolve outside node_modules).
      '@mochart/angular': fileURLToPath(new URL('../mochart-angular/src/index.ts', import.meta.url))
    },
    // The binding's own @angular imports resolve from its package, which can hold
    // a different patch of Angular than this app; two copies in one bundle throw
    // NG0203 the moment the binding calls inject().
    dedupe: ['@angular/core', '@angular/common', '@angular/platform-browser']
  },
  // The angular plugin compiles with AOT against tsconfig.app.json (its
  // default); tsconfig.json stays noEmit for the ngc typecheck script.
  plugins: [angular(), depSourcemaps()]
});
