import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Live tests hit the real node and are run explicitly via npm run test:live.
    exclude: ['tests/live/**', '**/node_modules/**', '**/.git/**'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});