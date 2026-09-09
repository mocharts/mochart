import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Golden demos with 2000ms animations re-render hundreds of frames; slow CI runners exceed the 5s default.
    // The golden suites raise this further for themselves (test/golden/goldenSuite.ts) — coverage runs starve them.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Type-only and generated modules carry no runtime behaviour to exercise.
      // The golden suites pull in demo-common's generators; they are not core code.
      exclude: ['src/types/**', 'src/**/*.d.ts', '**/mochart-demo-common/**'],
      reporter: ['text', 'html'],
      // a whisker under the current numbers: real erosion fails, an incidental refactor does not
      thresholds: { statements: 97, branches: 90, functions: 97, lines: 97 }
    }
  }
});
