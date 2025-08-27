import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@mui/material', '@mui/icons-material'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});