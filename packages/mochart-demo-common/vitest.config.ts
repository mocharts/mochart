import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // every runtime module, not just the ones a test happens to import
      include: ['src/**/*.ts'],
      reporter: ['text', 'html']
    }
  }
});
