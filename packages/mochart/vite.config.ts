import { defineConfig } from 'vite';

// Library build: bundles mochart together with everything it imports
// (d3-*, movalid) into self-contained browser artifacts, so d3-* are dev-only.
//   dist/mochart.js      — ES module, for <script type="module"> / bundlers
//   dist/mochart.iife.js — classic script, exposes the global `mochart`
export default defineConfig({
  build: {
    // pinned, not left to Vite's default: that default tracks current browser
    // baselines, so the documented support floor would rise on every Vite major
    target: 'es2020',
    lib: {
      entry: 'src/index.ts',
      name: 'mochart',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'mochart.js' : 'mochart.iife.js')
    },
    sourcemap: true
  }
});
