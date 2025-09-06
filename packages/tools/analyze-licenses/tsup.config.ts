import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  splitting: false,
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node18',
  banner: { js: '#!/usr/bin/env node' },
  external: [],
});

