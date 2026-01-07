import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'tests/**', '**/*.jest.test.ts', '**/*.jest.test.tsx'],
  },
});

