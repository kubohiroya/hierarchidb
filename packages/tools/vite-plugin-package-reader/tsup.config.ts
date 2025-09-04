import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: './src/index.ts',
    'presets/index': './src/presets/index.ts',
  },
  format: ['esm', 'cjs'],
  external: ['vite'],
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
});
