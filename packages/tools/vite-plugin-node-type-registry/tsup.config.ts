import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: ['src/index.ts'],
  dts: true,
  sourcemap: true,
  target: 'es2020',
  clean: true,
  external: ['vite'],
});
