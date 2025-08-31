import type { ViteDevServer, ModuleNode } from 'vite';
import type { 
  VitePluginPackageReaderOptions, 
  VitePluginPackageReaderAPI,
  VitePluginWithAPI,
  PackageJson 
} from '../types';
import { Logger } from '../core/Logger';
import { PackageDetector } from '../core/PackageDetector';
import { TransformPipeline } from '../pipeline/TransformPipeline';
import { VirtualModuleManager } from '../virtual/VirtualModuleManager';
import fs from 'fs/promises';

export function vitePluginPackageReader<T = any>(
  options: VitePluginPackageReaderOptions<T>
): VitePluginWithAPI<T> {
  // 初期化
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

  // 状態
  let packages = new Map<string, PackageJson>();
  let transformedData: T | undefined;
  let server: ViteDevServer | undefined;
  let isBuilding = false;

  // Virtual modules登録
  if (options.virtualModules) {
    for (const generator of options.virtualModules) {
      virtualManager.register(generator);
    }
  }

  /**
   * パッケージ検出と変換を実行
   */
  async function processPackages(): Promise<void> {
    try {
      // beforeDetection フック
      if (options.hooks?.beforeDetection) {
        await options.hooks.beforeDetection();
      }

      // パッケージ検出
      packages = await detector.detect(options.strategies);

      // afterDetection フック
      if (options.hooks?.afterDetection) {
        await options.hooks.afterDetection(packages);
      }

      // beforeTransform フック
      if (options.hooks?.beforeTransform) {
        packages = await options.hooks.beforeTransform(packages);
      }

      // 変換パイプライン実行
      if (pipeline) {
        transformedData = await pipeline.execute(packages);

        // afterTransform フック
        if (options.hooks?.afterTransform) {
          transformedData = await options.hooks.afterTransform(transformedData);
        }

        // Virtual modules生成
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
   * package.jsonの変更を監視
   */
  async function watchPackageJson(filePath: string): Promise<void> {
    if (!server || !options.watch) return;

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile() && filePath.endsWith('package.json')) {
        logger.info(`Package.json changed: ${filePath}`);
        
        // キャッシュクリア
        detector.clearCache();
        
        // 再処理
        await processPackages();
        
        // HMR通知
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

  // プラグイン定義
  const plugin: VitePluginWithAPI<T> = {
    name: '@hierarchidb/tools-vite-plugin-package-reader',
    
    api,

    async configResolved(config) {
      // ルートディレクトリを設定
      if (!options.rootDir) {
        options.rootDir = config.root;
      }
      
      // ログレベル設定
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
      
      // 開発サーバー起動時に処理
      devServer.httpServer?.once('listening', async () => {
        if (!isBuilding) {
          logger.info('Dev server started, processing packages...');
          await processPackages();
        }
      });

      // ファイル監視
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
      // package.jsonの変更を検出
      if (file.endsWith('package.json')) {
        logger.info(`HMR: package.json changed: ${file}`);
        
        // キャッシュクリア
        detector.clearCache();
        
        // 再処理
        await processPackages();
        
        // Virtual modulesを無効化
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

    async transform(code, id) {
      // Virtual module型定義の自動インポート
      if (options.virtualModules && (id.endsWith('.ts') || id.endsWith('.tsx'))) {
        const hasVirtualImport = options.virtualModules.some(vm => 
          code.includes(`'virtual:${vm.moduleId}'`) || 
          code.includes(`"virtual:${vm.moduleId}"`)
        );
        
        if (hasVirtualImport) {
          // 型定義を追加（開発時のみ）
          if (server) {
            let typeDefs = '';
            for (const vm of options.virtualModules) {
              const types = virtualManager.getTypes(vm.moduleId);
              if (types) {
                typeDefs += `\ndeclare module 'virtual:${vm.moduleId}' {\n${types}\n}\n`;
              }
            }
            
            if (typeDefs) {
              return {
                code: typeDefs + '\n' + code,
                map: null,
              };
            }
          }
        }
      }
      
      return null;
    },
  };

  return plugin;
}