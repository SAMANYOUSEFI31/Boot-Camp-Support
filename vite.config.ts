import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// دو صفحه: برنامهٔ اصلی و صفحهٔ آزمون‌ها
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', headers: { 'Allow-Connection-Allowlist-From': '*' } },
  preview: { host: '127.0.0.1', headers: { 'Allow-Connection-Allowlist-From': '*' } },
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
