import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  sourcemap: true,
  dts: true,
  clean: true,
  minify: false,
  external: ['vite'],
});
