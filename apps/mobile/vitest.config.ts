import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@paraapp/core-tracks': path.resolve(__dirname, '../../packages/core/src/tracks/index.ts'),
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
