import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react'],
    },
  },
  plugins: [
    dts({
      include: 'src/**/*.ts',
      exclude: 'src/**/*.test.ts',
    }),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
  },
});
