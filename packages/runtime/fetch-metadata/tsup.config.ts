import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2022',
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
      tsBuildInfoFile: undefined,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [],
});