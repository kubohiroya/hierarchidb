import { defineConfig, Options } from 'tsup';

/**
 * Base tsup configuration for all packages
 */
export const createTsupConfig = (options: Partial<Options> = {}): Options => {
  const defaultExternal = [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'react-router',
    'react-router-dom',
    'jotai',
    'maplibre-gl',
    'dexie',
    'react-i18next',
    'i18next',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-icon',
    '@hierarchidb/ui-treeconsole-trashbin',
    '@hierarchidb/ui-map',
  ];

  const mergedExternal = Array.from(
    new Set([...(defaultExternal as string[]), ...((options.external as string[] | undefined) ?? [])])
  );

  const { external: _externalIgnored, dts: _ignoredDts, ...restOptions } = options;

  return defineConfig({
    // Default entry point for packages
    entry: ['src/index.ts'],

    // Output formats
    format: ['esm'],

    // TypeScript configuration
    target: 'es2022',

    // Declaration bundling is handled by package-level tsc builds
    dts: false,

    // Build settings
    splitting: false,
    sourcemap: true,
    clean: true,

    // Common external dependencies (kept out of plugin bundles)
    // Policy: peer-managed runtime libs must be externalized
    external: mergedExternal,

    // Merge with package-specific options
    ...restOptions,
  }) as Options;
};
