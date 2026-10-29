import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// دو صفحه: برنامهٔ اصلی و صفحهٔ آزمون‌ها
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: root('./index.html'),
        tests: root('./tests.html')
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
});
