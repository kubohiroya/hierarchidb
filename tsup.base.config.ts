import { defineConfig, Options } from 'tsup';

/**
 * Base tsup configuration for all packages
 */
export const createTsupConfig = (options: Partial<Options> = {}): Options => {
  const isProduction = process.env.NODE_ENV === 'production';

  return defineConfig({
    // Default entry point
    entry: ['src/openstreetmap-type.ts'],

    // Output formats
    format: ['esm', 'cjs'],

    // Generate .d.ts files
    dts: true,

    // Clean output directory before build
    clean: true,

    // Generate source maps
    sourcemap: !isProduction,

    // Enable tree shaking
    treeshake: true,

    // Default output directory
    outDir: 'dist',

    // Common external dependencies
    external: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'dexie',
    ],

    // Merge with package-specific options
    ...options,
  }) as Options;
};
