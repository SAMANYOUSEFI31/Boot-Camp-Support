import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// دو صفحه: برنامهٔ اصلی و صفحهٔ آزمون‌ها
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        tests: resolve(import.meta.dirname, 'tests.html')
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js']
  }
});
