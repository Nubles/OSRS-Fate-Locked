import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vite.config';

export default defineConfig(async (env) => {
  const resolvedBase = typeof baseConfig === 'function'
    ? await baseConfig(env)
    : await baseConfig;
  return mergeConfig(resolvedBase, {
    test: {
      include: ['scripts/runeproof-performance-benchmark.ts'],
      environment: 'node',
      testTimeout: 120_000,
    },
  });
});
