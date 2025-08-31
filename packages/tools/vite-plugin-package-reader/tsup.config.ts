import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'presets/index': './src/presets/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['vite'],
  treeshake: true,
  minify: false,
});