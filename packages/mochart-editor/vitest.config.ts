import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      // a whisker under the current numbers: real erosion fails, an incidental refactor does not
      thresholds: { statements: 85, branches: 71, functions: 88, lines: 90 }
    }
  }
});
