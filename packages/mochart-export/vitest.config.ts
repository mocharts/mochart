import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      // a whisker under the current numbers: real erosion fails, an incidental refactor does not
      thresholds: { statements: 94, branches: 84, functions: 93, lines: 95 }
    }
  }
});
