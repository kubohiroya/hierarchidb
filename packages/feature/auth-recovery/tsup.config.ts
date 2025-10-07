import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/RuntimeWorkerService.ts'],
  format: ['esm'],
  sourcemap: true,
  dts: true,
  clean: true,
});

