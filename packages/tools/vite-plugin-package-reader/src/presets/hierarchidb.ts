import path from 'path';
import fs from 'fs';
import type {
  PackageDetectionStrategy,
  PackageJson,
  TransformPipelineOptions,
  VirtualModuleGenerator,
  VitePluginPackageReaderOptions,
} from '../types.js';
import { RegexStrategy } from '../strategies/index.js';
import { DependencyResolver } from '../pipeline/DependencyResolver.js';

/**
  * HierarchiDB
  */
export interface PluginDefinition {
  name: string;
  version: string;
  packageName: string;
  nodeType: string;
  priority: number;
  config?: any;
  dependencies?: string[];
  // Absolute file paths to dist entries resolved via /@fs for Vite to load reliably
  resolvedImport?: string; // generic (dist/index.js)
  resolvedWorkerImport?: string; // dist/worker/index.js if exists
  resolvedUiImport?: string; // dist/ui/index.js if exists
}

/**
  * HierarchiDB
  */
export interface HierarchiDBStrategyOptions {
  pattern?: RegExp;
  priorityPlugin?: string;
  extractPluginConfig?: boolean;
  priorityBoost?: number;
}

/**
  * HierarchiDB
  */
export function createHierarchiDBStrategy(
  options: HierarchiDBStrategyOptions = {},
): PackageDetectionStrategy {
  const pattern = options.pattern || /@hierarchidb\/node-type-.*-plugin$/;
  const priorityPlugin = options.priorityPlugin || 'folder';
  const priorityBoost = options.priorityBoost || 100;

  const strategy = new RegexStrategy({
    name: 'hierarchidb-plugin',
    pattern,
    metadataExtractor: (packageJson: PackageJson) => {
      const metadata: Record<string, any> = {};

      //  node-type
      const match = packageJson.name.match(/node-type-(.+)-plugin$/);
      if (match) {
        metadata.nodeType = match[1];
      }

      //  hierarchidb
      if (options.extractPluginConfig && packageJson.hierarchidb?.plugin) {
        metadata.pluginConfig = packageJson.hierarchidb.plugin;
      }

      return metadata;
    },
  });

  //  test
  const originalTest = strategy.test.bind(strategy);
  strategy.test = function(packageName: string, packageJson: PackageJson): boolean {
    if (!originalTest(packageName, packageJson)) {
      return false;
    }

    let priority = 1000;
    if (packageName.includes(priorityPlugin)) {
      priority = 1;
    } else {
      const match = packageName.match(/node-type-(.+)-plugin$/);
      if (match && match[1]) {
        priority = match[1].charCodeAt(0) + priorityBoost;
      }
    }

    packageJson.__priority = priority;

    return true;
  };

  return strategy;
}

/**
  * PluginDefinition
  */
export function createPluginDefinitionPipeline(): TransformPipelineOptions<PluginDefinition[]> {
  return {
    transform: (packages: Map<string, PackageJson>) => {
      const definitions: PluginDefinition[] = [];

      for (const [name, pkg] of packages) {
        const nodeType = pkg.__metadata?.nodeType ||
          name.replace('@hierarchidb/', '').replace('-plugin', '');
        // Resolve dist entries for Vite dev via /@fs
        let resolvedImport: string | undefined;
        let resolvedWorkerImport: string | undefined;
        let resolvedUiImport: string | undefined;
        if (pkg.__path) {
          const dir = path.dirname(pkg.__path);
          const toFs = (p: string | undefined) => (p && fs.existsSync(p) ? `/@fs/${p}` : undefined);

          // Prefer package.json exports if present
          const exportsField = pkg.exports || {};
          const resolveFromExport = (key: string): string | undefined => {
            try {
              const v = exportsField[key];
              const imp: string | undefined = v?.import || v?.default || (typeof v === 'string' ? v : undefined);
              if (!imp) return undefined;
              const abs = path.join(dir, imp);
              return fs.existsSync(abs) ? abs : undefined;
            } catch {
              return undefined;
            }
          };

          const prefer = (
            candidates: Array<string | undefined>,
          ): string | undefined => candidates.find((p) => !!p && fs.existsSync(p as string));

          const genericByExport = resolveFromExport('.');
          const workerByExport = resolveFromExport('./worker');
          const uiByExport = resolveFromExport('./ui');

          const distRoot = path.join(dir, 'dist');
          const genericByScan = prefer([
            path.join(distRoot, 'index.js'),
            path.join(distRoot, 'index.mjs'),
          ]);
          const workerByScan = prefer([
            path.join(distRoot, 'worker', 'index.js'),
            path.join(distRoot, 'worker', 'index.mjs'),
          ]);
          const uiByScan = prefer([
            path.join(distRoot, 'ui', 'index.js'),
            path.join(distRoot, 'ui', 'index.mjs'),
          ]);

          resolvedImport = toFs(genericByExport || genericByScan);
          resolvedWorkerImport = toFs(workerByExport || workerByScan);
          resolvedUiImport = toFs(uiByExport || uiByScan);
        }

        definitions.push({
          name: nodeType,
          version: pkg.version,
          packageName: name,
          nodeType,
          priority: pkg.__priority || 1000,
          config: pkg.__metadata?.pluginConfig || pkg.hierarchidb?.plugin,
          dependencies: DependencyResolver.getDependencies(pkg),
          resolvedImport,
          resolvedWorkerImport,
          resolvedUiImport,
        });
      }

      //  priority
      return definitions.sort((a, b) => a.priority - b.priority);
    },
  };
}

/**
  * Virtual Module
  */
export function createPluginVirtualModule(): VirtualModuleGenerator<PluginDefinition[]> {
  return {
    moduleId: 'plugin-definitions',

    generate: (definitions: PluginDefinition[]) => {
      // Worker-safe: do not import plugin packages here.
      const registrations: string[] = definitions.map(def => `{
  name: '${def.name}',
  version: '${def.version}',
  packageName: '${def.packageName}',
  nodeType: '${def.nodeType}',
  priority: ${def.priority},
  plugin: undefined,
  config: ${JSON.stringify(def.config || {}, null, 2).split('\n').join('\n  ')}
}`);

      return `// Auto-generated by @hierarchidb/tools-vite-plugin-package-reader (metadata only)
export const pluginDefinitions = [
  ${registrations.join(',\n  ')}
];

export default pluginDefinitions;
`;
    },

    generateTypes: (definitions: PluginDefinition[]) => {
      const nodeTypes = definitions.map(d => `'${d.nodeType}'`).join(' | ');

      return `
export interface PluginDefinition {
  name: string;
  version: string;
  packageName: string;
  nodeType: string;
  priority: number;
  plugin?: any;
  config?: any;
}

export type NodeType = ${nodeTypes};

export const pluginDefinitions: PluginDefinition[];
export default pluginDefinitions;
`;
    },
  };
}

/**
  * HierarchiDB
  */
export function hierarchiDBPreset(
  options: Partial<HierarchiDBStrategyOptions> = {},
): VitePluginPackageReaderOptions<PluginDefinition[]> {
  return {
    strategies: [createHierarchiDBStrategy(options)],
    pipeline: createPluginDefinitionPipeline(),
    virtualModules: [createPluginVirtualModule()],
    monorepo: {
      packages: ['packages/node-type/*'],
      resolveWorkspace: true,
      usePnpmWorkspace: true,
    },
    cache: true,
    watch: true,
    logger: {
      level: 'info',
      prefix: '[HierarchiDB]',
    },
    hooks: {
      afterDetection: async (packages) => {
        console.log(`Found ${packages.size} HierarchiDB plugins`);
      },
    },
  };
}

/**
  * Virtual Module
  */
export function hierarchiDBMultiModulePreset(
  options: Partial<HierarchiDBStrategyOptions> = {},
): VitePluginPackageReaderOptions<PluginDefinition[]> {
  const base = hierarchiDBPreset(options);

  //  Virtual Modules
  const pluginMapModule: VirtualModuleGenerator<PluginDefinition[]> = {
    moduleId: 'plugin-map',
    generate: (definitions) => {
      const uiEntries = definitions.map(d => {
        const target = d.packageName;
        return `  '${d.nodeType}': () => import('${target}')`;
      });
      const workerEntries = definitions.map(d => {
        const target = d.resolvedWorkerImport || d.packageName;
        return `  '${d.nodeType}': () => import('${target}')`;
      });

      return `// Auto-generated plugin maps (UI + Worker)
export const pluginMap = {
${uiEntries.join(',\n')}
};

export const pluginMapWorker = {
${workerEntries.join(',\n')}
};

export default pluginMap;
`;
    },
  };

  // Worker-targeted plugin map: prefer worker entry if available
  // Note: keep a dedicated worker module for backward compatibility if some code imports it directly
  const pluginMapWorkerModule: VirtualModuleGenerator<PluginDefinition[]> = {
    moduleId: 'plugin-map-worker',
    generate: (definitions) => {
      const entries = definitions.map(d => {
        const target = d.resolvedWorkerImport || d.packageName;
        return `  '${d.nodeType}': () => import('${target}')`;
      });

      return `// Auto-generated worker plugin map (compat)
export const pluginMap = {
${entries.join(',\n')}
};

export default pluginMap;
`;
    },
  };

  const pluginTypesModule: VirtualModuleGenerator<PluginDefinition[]> = {
    moduleId: 'plugin-types',
    generate: (definitions) => {
      const types = definitions.map(d => `  ${d.nodeType}: '${d.nodeType}'`);

      return `// Auto-generated plugin types
export const NodeTypes = {
${types.join(',\n')}
} as const;

export type NodeType = keyof typeof NodeTypes;
`;
    },
  };

  return {
    ...base,
    virtualModules: [
      createPluginVirtualModule(),
      pluginMapModule,
      pluginMapWorkerModule,
      pluginTypesModule,
    ],
  };
}
