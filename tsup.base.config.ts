import { defineConfig, Options } from 'tsup';

/**
 * Base tsup configuration for all packages
 */
export const createTsupConfig = (options: Partial<Options> = {}): Options => {
  return defineConfig({
    // Default entry point for packages
    entry: ['src/index.ts'],

    // Output formats
    format: ['esm'],
    
    // TypeScript configuration
    target: 'es2022',

    // Generate .d.ts files with optimized settings
    dts: {
      compilerOptions: {
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
      },
    },

    // Build settings
    splitting: false,
    sourcemap: true,
    clean: true,

    // Common external dependencies
    external: [
      'provider',
      'provider-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/provider',
      '@emotion/styled',
    ],

    // Merge with package-specific options
    ...options,
  }) as Options;
};
