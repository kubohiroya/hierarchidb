/**
 * プラグイン初期化器（Template Method Pattern）
 */

import { NodeType, PluginDefinition, PluginIntegrated, EntityHandler } from '@hierarchidb/common-type';

/**
 * 初期化コンテキスト
 */
export interface InitializationContext {
  /** プラグイン定義 */
  definition: PluginDefinition;
  
  /** 初期化順序 */
  initializationOrder: NodeType[];
  
  /** すでに初期化済みのプラグイン */
  initializedPlugins: Map<NodeType, PluginIntegrated>;
}

/**
 * 初期化結果
 */
export interface InitializationResult {
  /** 成功したか */
  success: boolean;
  
  /** 統合されたプラグイン */
  integrated?: PluginIntegrated;
  
  /** エラー */
  error?: Error;
}

/**
 * プラグイン初期化器の抽象基底クラス（Template Method Pattern）
 */
export abstract class PluginInitializer {
  protected iconResolver: IconResolver;
  protected componentLoader: ComponentLoader;
  protected integrationBuilder: PluginIntegrationBuilder;
  
  constructor() {
    this.iconResolver = new IconResolver();
    this.componentLoader = new ComponentLoader();
    this.integrationBuilder = new PluginIntegrationBuilder();
  }
  
  /**
   * テンプレートメソッド：プラグイン初期化のフロー
   */
  async initialize(context: InitializationContext): Promise<InitializationResult> {
    try {
      // Step 1: 事前チェック
      await this.preInitialize(context);
      
      // Step 2: エンティティハンドラーをロード
      const entityHandler = await this.loadEntityHandler(context);
      
      // Step 3: ライフサイクルフックをロード
      const lifecycle = await this.loadLifecycleHooks(context);
      
      // Step 4: アイコンを解決
      const resolvedIcon = await this.iconResolver.resolve(context.definition.icon);
      
      // Step 5: UIコンポーネントをロード
      const resolvedUI = await this.componentLoader.loadComponents(
        context.definition.ui,
        context.definition.nodeType
      );
      
      // Step 6: メタデータを生成
      const metadata = this.generateMetadata(context);
      
      // Step 7: 統合オブジェクトを構築
      const integrated = await this.integrationBuilder.build({
        ...context.definition,
        entityHandler,
        lifecycle,
        routing: await this.loadRouting(context),
        resolvedIcon,
        resolvedUI,
        metadata,
      });
      
      // Step 8: 事後処理
      await this.postInitialize(integrated, context);
      
      return {
        success: true,
        integrated,
      };
    } catch (error) {
      console.error(`Failed to initialize plugin ${context.definition.nodeType}:`, error);
      return {
        success: false,
        error: error as Error,
      };
    }
  }
  
  /**
   * 初期化前処理（フック）
   */
  protected async preInitialize(context: InitializationContext): Promise<void> {
    console.log(`Initializing plugin: ${context.definition.nodeType}`);
  }
  
  /**
   * 初期化後処理（フック）
   */
  protected async postInitialize(_integrated: PluginIntegrated, context: InitializationContext): Promise<void> {
    console.log(`Plugin initialized: ${context.definition.nodeType}`);
  }
  
  /**
   * エンティティハンドラーをロード（抽象メソッド）
   */
  protected abstract loadEntityHandler(context: InitializationContext): Promise<EntityHandler>;
  
  /**
   * ライフサイクルフックをロード
   */
  protected abstract loadLifecycleHooks(context: InitializationContext): Promise<any>;
  
  /**
   * ルーティング設定をロード
   */
  protected abstract loadRouting(context: InitializationContext): Promise<any>;
  
  /**
   * メタデータを生成
   */
  private generateMetadata(context: InitializationContext): any {
    const capabilities = new Set<string>();
    
    if (context.definition.validation) capabilities.add('validation');
    if (context.definition.api?.workerExtensions) capabilities.add('worker-api');
    if (context.definition.ui) capabilities.add('ui');
    
    return {
      isAvailable: true,
      loadedAt: new Date(),
      capabilities,
      resolvedDependencies: context.definition.dependencies.filter(
        dep => context.initializationOrder.includes(dep as NodeType)
      ) as NodeType[],
    };
  }
}

/**
 * 標準プラグイン初期化器
 */
export class StandardPluginInitializer extends PluginInitializer {
  protected async loadEntityHandler(context: InitializationContext): Promise<EntityHandler> {
    const packageName = `@hierarchidb/${context.definition.nodeType}-plugin`;
    
    try {
      // Worker モジュールをインポート
      const module = await import(`${packageName}/worker`);
      
      // エンティティハンドラーを抽出
      if (module.entityHandler) return module.entityHandler;
      if (module.default) return module.default;
      if (module.EntityHandler) return new module.EntityHandler();
      
      throw new Error(`No entity handler found in ${packageName}`);
    } catch (error) {
      // フォールバック
      const fallbackModule = await import(packageName);
      if (fallbackModule.entityHandler) return fallbackModule.entityHandler;
      
      throw error;
    }
  }
  
  protected async loadLifecycleHooks(context: InitializationContext): Promise<any> {
    const packageName = `@hierarchidb/${context.definition.nodeType}-plugin`;
    
    try {
      const module = await import(`${packageName}/worker`);
      return module.lifecycle || undefined;
    } catch {
      return undefined;
    }
  }
  
  protected async loadRouting(context: InitializationContext): Promise<any> {
    const packageName = `@hierarchidb/${context.definition.nodeType}-plugin`;
    
    try {
      const module = await import(`${packageName}/worker`);
      return module.routing || this.createDefaultRouting();
    } catch {
      return this.createDefaultRouting();
    }
  }
  
  private createDefaultRouting(): any {
    return {
      actions: {
        view: { path: 'view', componentPath: 'ViewComponent' },
        edit: { path: 'edit', componentPath: 'EditComponent' },
      },
      defaultAction: 'view',
    };
  }
}

/**
 * アイコン解決器
 */
export class IconResolver {
  async resolve(iconDef?: any): Promise<any> {
    if (!iconDef) return undefined;
    
    const resolved: any = {};
    
    // MUIアイコン解決
    if (iconDef.muiIconName) {
      const iconName = this.pascalCase(iconDef.muiIconName);
      // 動的インポートは実行時に行う
      // ここではアイコン名のみを保存
      (resolved as any).muiIconName = iconName;
    }
    
    // 絵文字
    if (iconDef.emoji) {
      resolved.emoji = iconDef.emoji;
    }
    
    return Object.keys(resolved).length > 0 ? resolved : undefined;
  }
  
  private pascalCase(str: string): string {
    return str
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

/**
 * コンポーネントローダー
 */
export class ComponentLoader {
  async loadComponents(uiConfig?: any, nodeType?: NodeType): Promise<any> {
    if (!uiConfig) return undefined;
    
    const resolved: any = {};
    const packageName = `@hierarchidb/${nodeType}-plugin`;
    
    // 各コンポーネントを動的ロード
    const loaders = {
      dialogComponent: uiConfig.dialogComponentPath,
      panelComponent: uiConfig.panelComponentPath,
      formComponent: uiConfig.formComponentPath,
      iconComponent: uiConfig.iconComponentPath,
    };
    
    for (const [key, path] of Object.entries(loaders)) {
      if (path) {
        try {
          const fullPath = `${packageName}/${path}`;
          const module = await import(fullPath);
          resolved[key as keyof typeof resolved] = module.default || module;
        } catch (error) {
          console.warn(`Failed to load component ${path}:`, error);
        }
      }
    }
    
    return Object.keys(resolved).length > 0 ? resolved : undefined;
  }
}

/**
 * 統合ビルダー
 */
export class PluginIntegrationBuilder {
  async build(data: any): Promise<PluginIntegrated> {
    return data as PluginIntegrated;
  }
}