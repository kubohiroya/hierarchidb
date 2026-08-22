import { existsSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { defineConfig, type Options, type OutExtensionFactory, type UserConfig } from 'tsdown';

type PackageJson = {
  name?: string;
  type?: string;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  tsdown?: Record<string, unknown>;
};

const DEFAULT_EXTERNAL = [
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
  'worker_threads',
];

const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');
type TsdownWorkspaceConfig = Omit<Options, 'config' | 'filter'> & {
  outExtensions?: OutExtensionFactory | string;
  outExtension?: OutExtensionFactory | string;
  define?: Record<string, string>;
  plugins?: Options['plugins'];
};

let pkg: PackageJson = {};
try {
  pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
} catch {
  // Fallback to empty package.json when not available.
}

const dependencyNames = new Set<string>(DEFAULT_EXTERNAL);
for (const group of [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
  if (!group) continue;
  for (const name of Object.keys(group)) {
    dependencyNames.add(name);
  }
}

const userConfig = (pkg.tsdown ?? {}) as Partial<TsdownWorkspaceConfig> & Record<string, unknown>;

const baseExternal = Array.from(dependencyNames);
let mergedExternal: string[] = baseExternal;

const userConfigValues = userConfig;
const userExternal = userConfigValues.external as
  | string[]
  | string
  | Record<string, unknown>
  | undefined;
if (Array.isArray(userExternal)) {
  const extended = new Set<string>([...baseExternal, ...userExternal]);
  mergedExternal = Array.from(extended);
} else if (typeof userExternal === 'string') {
  mergedExternal = [userExternal];
} else if (userExternal && typeof userExternal === 'object') {
  mergedExternal = Object.keys(userExternal).filter(
    (key): key is string => typeof key === 'string'
  );
}

const {
  external: _ignoredExternal,
  outExtension: legacyOutExtension,
  outExtensions: rawOutExtensions,
  tsconfig: userTsconfig,
  alias: userAlias,
  ...restUserConfig
}: Partial<TsdownWorkspaceConfig> & Record<string, unknown> = userConfig;

const toOutExtension = (
  value: OutExtensionFactory | string | undefined
): OutExtensionFactory | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value === 'string') {
    return () => ({ js: value, dts: value.replace(/\.js$/, '.d.ts') });
  }
  return value;
};

const normalizedOutExtension = toOutExtension(rawOutExtensions ?? legacyOutExtension);

const defaultOutExtension = () => ({
  js: '.js',
  dts: '.d.ts',
});

const defaultAlias: Record<string, string> = {
  '~': path.resolve(cwd, 'src'),
  '~/': path.resolve(cwd, 'src'),
};
const defaultPublicAliasPath = path.resolve(cwd, 'public');
if (existsSync(defaultPublicAliasPath)) {
  defaultAlias['~/public/'] = defaultPublicAliasPath;
  defaultAlias['~/public'] = defaultPublicAliasPath;
}

const mergedAlias = {
  ...defaultAlias,
  ...(typeof userAlias === 'object' && userAlias && !Array.isArray(userAlias) ? userAlias : {}),
};

const packageWorkspaceAliasPlugin = {
  name: 'workspace-tilde-alias',
  async resolveId(id: string) {
    if (!id.startsWith('~/')) {
      return undefined;
    }

    const normalizedPath = id.slice(2);
    const isPublic = normalizedPath.startsWith('public/');
    const baseDir = isPublic ? path.join(cwd, 'public') : path.join(cwd, 'src');
    const relativePath = isPublic ? normalizedPath.slice('public/'.length) : normalizedPath;
    const targetWithoutExt = path.join(baseDir, relativePath);

    const candidates = [
      targetWithoutExt,
      `${targetWithoutExt}.ts`,
      `${targetWithoutExt}.tsx`,
      `${targetWithoutExt}.mts`,
      `${targetWithoutExt}.cts`,
      `${targetWithoutExt}.js`,
      `${targetWithoutExt}.jsx`,
      `${targetWithoutExt}.mjs`,
      `${targetWithoutExt}.cjs`,
      `${targetWithoutExt}.json`,
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return undefined;
  },
};

const baseConfig: TsdownWorkspaceConfig = {
  name: pkg.name,
  format: ['esm'] as const,
  platform: 'node' as const,
  clean: false,
  sourcemap: true,
  outDir: 'dist',
  dts: true,
  external: mergedExternal,
  outExtensions: defaultOutExtension,
  hash: false,
};

const resolvedUserPlugins = (() => {
  const userPlugins = restUserConfig.plugins;
  if (!userPlugins) {
    return [packageWorkspaceAliasPlugin];
  }
  return [
    ...(Array.isArray(userPlugins) ? userPlugins : [userPlugins]),
    packageWorkspaceAliasPlugin,
  ];
})();

const finalConfig: TsdownWorkspaceConfig = {
  ...baseConfig,
  ...restUserConfig,
  tsconfig:
    typeof userTsconfig === 'string' || typeof userTsconfig === 'boolean' ? userTsconfig : true,
  alias: mergedAlias,
  plugins: resolvedUserPlugins as Options['plugins'],
};

if (normalizedOutExtension !== undefined) {
  finalConfig.outExtensions = normalizedOutExtension;
}

const hasObjectEntries = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

const userInputOptions = finalConfig.inputOptions;
const hasExplicitDefines =
  hasObjectEntries(finalConfig.define) || hasObjectEntries(finalConfig.env);
const hasExplicitInjects = finalConfig.shims === true;
finalConfig.inputOptions = async (options, format, context) => {
  if (!hasExplicitDefines) {
    delete (options as { define?: unknown }).define;
  }
  if (!hasExplicitInjects) {
    delete (options as { inject?: unknown }).inject;
  }
  if (typeof userInputOptions === 'function') {
    return userInputOptions(options, format, context);
  }
  return userInputOptions;
};

if (process.env.TSDOWN_DEBUG === '1') {
  console.log('[tsdown-config]', JSON.stringify(finalConfig, null, 2));
}

export default defineConfig(finalConfig as UserConfig);
