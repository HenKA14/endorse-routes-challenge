/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
