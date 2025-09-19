import type { ModuleNode, ViteDevServer } from 'vite';
import type {
  PackageJson,
  VitePluginPackageReaderAPI,
  VitePluginPackageReaderOptions,
  VitePluginWithAPI,
} from '../types.js';
import { Logger } from '../core/Logger.js';
import { PackageDetector } from '../core/PackageDetector.js';
import { TransformPipeline } from '../pipeline/TransformPipeline.js';
import { VirtualModuleManager } from '../virtual/VirtualModuleManager.js';
import fs from 'fs/promises';

export function vitePluginPackageReader<T = any>(
  options: VitePluginPackageReaderOptions<T>,
): VitePluginWithAPI<T> {
  const logger = new Logger(options.logger);
  const detector = new PackageDetector({
    rootDir: options.rootDir,
    cache: options.cache,
    logger,
    monorepo: options.monorepo,
  });
  const virtualManager = new VirtualModuleManager(logger);

  let pipeline: TransformPipeline<T> | undefined;
  if (options.pipeline) {
    pipeline = new TransformPipeline(options.pipeline, logger);
  }

  let packages = new Map<string, PackageJson>();
  let transformedData: T | undefined;
  let server: ViteDevServer | undefined;
  let isBuilding = false;

  //  Virtual modules
  if (options.virtualModules) {
    for (const generator of options.virtualModules) {
      virtualManager.register(generator);
    }
  }

  /**
            */
  async function processPackages(): Promise<void> {
    try {
      //  beforeDetection
      if (options.hooks?.beforeDetection) {
        await options.hooks.beforeDetection();
      }

      packages = await detector.detect(options.strategies);

      //  afterDetection
      if (options.hooks?.afterDetection) {
        await options.hooks.afterDetection(packages);
      }

      //  beforeTransform
      if (options.hooks?.beforeTransform) {
        packages = await options.hooks.beforeTransform(packages);
      }

      if (pipeline) {
        transformedData = await pipeline.execute(packages);

        //  afterTransform
        if (options.hooks?.afterTransform) {
          transformedData = await options.hooks.afterTransform(transformedData);
        }

        //  Virtual modules
        if (options.virtualModules && transformedData !== undefined) {
          await virtualManager.generate(transformedData);
        }
      }

      logger.info(`Processed ${packages.size} packages`);
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to process packages:', err.message);

      if (options.hooks?.onError) {
        options.hooks.onError(err, 'processPackages');
      } else {
        throw err;
      }
    }
  }

  /**
      * package.json
      */
  async function watchPackageJson(filePath: string): Promise<void> {
    if (!server || !options.watch) return;

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile() && filePath.endsWith('package.json')) {
        logger.info(`Package.json changed: ${filePath}`);

        detector.clearCache();

        await processPackages();

        //  HMR
        const moduleIds = virtualManager.getModuleIds();
        for (const moduleId of moduleIds) {
          const module = server.moduleGraph.getModuleById(`\0virtual:${moduleId}`);
          if (module) {
            server.moduleGraph.invalidateModule(module);
            server.ws.send({
              type: 'full-reload',
              path: '*',
            });
          }
        }
      }
    } catch (error) {
      logger.debug(`Could not watch ${filePath}:`, error);
    }
  }

  // API
  const api: VitePluginPackageReaderAPI<T> = {
    getPackages(): Map<string, PackageJson> {
      return new Map(packages);
    },
    getTransformed(): T | undefined {
      return transformedData;
    },
    clearCache(): void {
      detector.clearCache();
      virtualManager.clear();
    },
    async reload(): Promise<void> {
      await processPackages();
    },
  };

  const plugin: VitePluginWithAPI<T> = {
    name: '@hierarchidb/tools-vite-plugin-package-reader',

    api,

    async configResolved(config) {
      if (!options.rootDir) {
        options.rootDir = config.root;
      }

      if (config.logLevel && !options.logger?.level) {
        const levelMap: Record<string, any> = {
          error: 'error',
          warn: 'warn',
          info: 'info',
          silent: 'silent',
        };
        logger.setLevel(levelMap[config.logLevel] || 'info');
      }
    },

    async buildStart() {
      isBuilding = true;
      logger.info('Build started, processing packages...');
      await processPackages();
    },

    buildEnd() {
      isBuilding = false;
    },

    configureServer(devServer) {
      server = devServer;

      devServer.httpServer?.once('listening', async () => {
        if (!isBuilding) {
          logger.info('Dev server started, processing packages...');
          await processPackages();
        }
      });

      if (options.watch !== false) {
        devServer.watcher.on('change', watchPackageJson);
        devServer.watcher.on('add', watchPackageJson);
      }
    },

    resolveId(id) {
      return virtualManager.resolveId(id);
    },

    load(id) {
      return virtualManager.load(id);
    },

    async handleHotUpdate({ file, server, modules }) {
      //  package.json
      if (file.endsWith('package.json')) {
        logger.info(`HMR: package.json changed: ${file}`);

        detector.clearCache();

        await processPackages();

        //  Virtual modules
        const virtualModules: ModuleNode[] = [];
        const moduleIds = virtualManager.getModuleIds();

        for (const moduleId of moduleIds) {
          const module = server.moduleGraph.getModuleById(`\0virtual:${moduleId}`);
          if (module) {
            virtualModules.push(module);
          }
        }

        if (virtualModules.length > 0) {
          return virtualModules;
        }
      }

      return modules;
    },

    async transform(_code: string, _id: string) {
      // mark parameters as intentionally unused to satisfy noUnusedParameters
      void _code; void _id;
      // Note: We no longer inject TypeScript ambient declarations into source files.
      // The app/projects are expected to provide their own .d.ts shims for virtual modules.
      // This avoids surfacing `declare module` in environments where the TS transform
      // ordering differs (e.g., react-router/dev), which could lead to runtime SyntaxError.
      return null;
    },
  };

  return plugin;
}
