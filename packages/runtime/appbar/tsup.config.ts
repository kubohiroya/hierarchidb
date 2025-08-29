import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    'react-router-dom'
  ],
});