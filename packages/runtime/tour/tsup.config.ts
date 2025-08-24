import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2022',
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
      tsBuildInfoFile: undefined,
      paths: {
        "@hierarchidb/ui-tour": ["../../ui/tour/dist/index.d.ts"]
      }
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});