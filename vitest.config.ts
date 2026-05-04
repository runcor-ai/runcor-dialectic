import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // Regression tests opt-in via env var (require live API keys / cost)
      ...(process.env.RUN_REGRESSION ? [] : ['tests/regression/**']),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        // Constitution Principle II: 100% on convergence-decision paths
        'src/convergence.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
