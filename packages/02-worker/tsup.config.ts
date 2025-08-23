import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2022',
  entry: ['src/index.ts', 'src/worker-entry.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
      tsBuildInfoFile: undefined,
    },
  },
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ['dexie', 'comlink', 'rxjs'],
});