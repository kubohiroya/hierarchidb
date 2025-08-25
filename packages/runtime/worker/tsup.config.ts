import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2022',
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    resolve: true,
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['dexie', 'comlink', 'rxjs'],
});
