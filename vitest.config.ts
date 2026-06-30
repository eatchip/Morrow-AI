import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/app/renderer/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/contract/**/*.{test,spec}.ts',
      'tests/integration/**/*.{test,spec}.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'out/**', 'dist/**'],
    setupFiles: ['./tests/setup/vitest.setup.ts'],
  },
});
