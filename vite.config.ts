/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep every asset as a file so the CSP never needs data: for fonts or styles.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'supabase/tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
