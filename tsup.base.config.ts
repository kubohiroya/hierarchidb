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

  return defineConfig({
    // Default entry point for packages
    entry: ['src/index.ts'],

    // Output formats
    format: ['esm'],
    
    // TypeScript configuration
    target: 'es2022',

    // Generate .d.ts files with optimized settings
    dts: {
      // Avoid inlining external .d.ts (react, mui, workspace peers)
      // This prevents API Extractor from pulling in TS5-specific paths like
      // '@types/react/ts5.0/jsx-runtime' into the bundled output.
      resolve: false,
      compilerOptions: {
        module: 'Node16',
        composite: false,
        incremental: false,
        tsBuildInfoFile: undefined,
        // Align with package Node16 resolution during DTS bundling
        moduleResolution: 'Node16',
        resolveJsonModule: true,
        // Keep JSX types external to avoid leaking jsx-runtime symbols
        jsx: 'react-jsx',
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        // Do not fail DTS bundling on local unuseds; keep tsc typecheck strict
        noUnusedLocals: false,
        noUnusedParameters: false,
        // Include Vite's ambient definitions so packages using import.meta.env compile during DTS bundling.
        types: ['react', 'node', 'vite/client'],
      },
    },

    // Build settings
    splitting: false,
    sourcemap: true,
    clean: true,

    // Common external dependencies (kept out of plugin bundles)
    // Policy: peer-managed runtime libs must be externalized
    external: mergedExternal,

    // Merge with package-specific options
    ...options,
  }) as Options;
};
