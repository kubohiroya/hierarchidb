import { defineConfig, Options } from 'tsup';

/**
 * Base tsup configuration for all packages
 */
export const createTsupConfig = (options: Partial<Options> = {}): Options => {
  const { dts: userDts, ...rest } = options;

  const defaultDts: Exclude<Options['dts'], undefined> = {
    outDir: 'dist',
    resolve: false,
    compilerOptions: {
      module: 'NodeNext',
      composite: false,
      incremental: false,
      tsBuildInfoFile: undefined,
      moduleResolution: 'NodeNext',
      resolveJsonModule: true,
      jsx: 'react-jsx',
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      types: ['react', 'node', 'vite/client'],
    },
  };

  let dtsOption: Options['dts'];
  if (userDts === undefined) {
    dtsOption = defaultDts;
  } else if (userDts === true) {
    dtsOption = defaultDts;
  } else if (userDts === false) {
    dtsOption = false;
  } else {
    dtsOption = {
      ...defaultDts,
      ...userDts,
      compilerOptions: {
        ...defaultDts.compilerOptions,
        ...(userDts.compilerOptions ?? {}),
      },
    };
  }

  const defaultExternal = [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
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

    // Ensure dist folders are pruned before each build
    clean: true,

    // TypeScript configuration
    target: 'es2022',

    // Generate .d.ts files with optimized settings
    dts: dtsOption,

    // Build settings
    splitting: false,
    sourcemap: true,

    // Common external dependencies (kept out of plugin bundles)
    // Policy: peer-managed runtime libs must be externalized
    external: mergedExternal,

    // Merge with package-specific options
    ...rest,
  }) as Options;
};
