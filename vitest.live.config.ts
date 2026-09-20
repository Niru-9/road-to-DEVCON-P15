// Live succession vitest config — used ONLY by `npm run test:live`.
// Deliberately separate from vitest.config.ts, which keeps the deterministic
// 24-test floor: this config discovers ONLY tests/live/**/*.test.ts, the REAL
// authority -> root feed -> publisher feed -> content round trip against the
// local Bee node. The live test never mocks the node, never reuses a historical
// root topic, and never claims unrun results: on first live failure it STOPS.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/live/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});