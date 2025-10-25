import { defineConfig, Options } from 'tsup';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Base tsup configuration for all packages
 */
export const createTsupConfig = (options: Partial<Options> = {}): Options => {
  const { dts: userDts, ...rest } = options;

  const defaultDts: Exclude<Options['dts'], undefined> = {
    outDir: 'dist',
    resolve: false,
    tsconfig: './tsconfig.build.json',
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

  let peerDeps: string[] = [];
  try {
    const pkgJsonPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      peerDependencies?: Record<string, unknown>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    if (pkg.peerDependencies) {
      peerDeps = Object.entries(pkg.peerDependencies)
        .filter(([name]) => {
          const meta = pkg.peerDependenciesMeta?.[name];
          return meta?.optional !== true;
        })
        .map(([name]) => name);
    }
  } catch (error) {
    // Fallback to no peer-derived externals when package.json is unavailable.
    if (process.env.DEP_FENCE_DEBUG) {
      console.warn('[tsup.base.config] failed to read peerDependencies:', error);
    }
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
    new Set([
      ...(defaultExternal as string[]),
      ...peerDeps,
      ...((options.external as string[] | undefined) ?? []),
    ])
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
