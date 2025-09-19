# @hierarchidb/tools-vite-plugin-package-reader

モノレポ環境でパッケージを自動検出し、Virtual Moduleとして利用可能にする汎用的なViteプラグインです。

## なぜこのプラグインが必要か？

### 解決する課題

モノレポ環境での開発において、以下のような課題があります：

1. **プラグインの動的ロード**: 実行時にどのプラグインが利用可能か事前に知ることが困難
2. **手動管理の煩雑さ**: 新しいパッケージを追加するたびに、インポート文を手動で更新する必要がある
3. **ビルド時の最適化**: 使用されないプラグインもバンドルに含まれてしまう
4. **型安全性の欠如**: 動的にロードされるモジュールの型情報が失われる
5. **保守性の低下**: パッケージが増えるほど管理が困難になる

### このプラグインのソリューション

```typescript
// 従来の方法（手動管理）
import folderPlugin from '@hierarchidb/node-type-folder-plugin';
import shapePlugin from '@hierarchidb/node-type-shape-plugin';
import routePlugin from '@hierarchidb/node-type-route-plugin';
import spreadsheetPlugin from '@hierarchidb/node-type-spreadsheet-plugin';
import locationPlugin from '@hierarchidb/node-type-location-plugin';
// ... 新しいプラグインを追加するたびにここを更新...

const plugins = [
  folderPlugin, 
  shapePlugin, 
  routePlugin, 
  spreadsheetPlugin,
  locationPlugin,
  // ... 忘れずに追加する必要がある
];

// このプラグインを使用（自動検出）
import plugins from 'virtual:plugin-definitions';
// すべてのプラグインが自動的に検出され、利用可能に！
// 新しいプラグインを追加しても、コードの変更は不要
```

## 主な用途

### 1. プラグインシステムの構築

アプリケーションに動的に機能を追加するプラグインシステムを構築する際に最適です。

```typescript
// プラグインを自動検出して登録
import { pluginDefinitions } from 'virtual:plugin-definitions';

class PluginManager {
  private plugins = new Map();
  
  async initialize() {
    // すべてのプラグインを自動的にロード
    for (const definition of pluginDefinitions) {
      console.log(`Loading plugin: ${definition.name} v${definition.version}`);
      const module = await definition.load();
      this.plugins.set(definition.name, module);
    }
  }
  
  getPlugin(name: string) {
    return this.plugins.get(name);
  }
}
```

### 2. マイクロフロントエンドのモジュール管理

複数のチームが開発するマイクロフロントエンドモジュールを自動的に統合します。

```typescript
// 各チームのモジュールを自動検出
import { modules } from 'virtual:micro-frontend-modules';

// 自動的にルーティングを構築
const router = createRouter({
  routes: modules.flatMap(m => m.routes)
});

// 各モジュールのナビゲーションメニューを統合
const navigation = modules.flatMap(m => m.menuItems);
```

### 3. コンポーネントライブラリの自動エクスポート

UIコンポーネントライブラリで、すべてのコンポーネントを自動的にエクスポートします。

```typescript
// virtual:components から自動生成されたエクスポート
export { Button } from '@mylib/button';
export { Input } from '@mylib/input';
export { Select } from '@mylib/select';
export { DatePicker } from '@mylib/date-picker';
// ... 新しいコンポーネントは自動的に追加される
```

### 4. テーマシステムの構築

複数のテーマパッケージを自動検出し、動的に切り替え可能にします。

```typescript
import { themes } from 'virtual:theme-registry';

// 利用可能なテーマを自動的にリスト化
const availableThemes = themes.map(t => ({
  id: t.id,
  name: t.name,
  preview: t.preview
}));

// テーマの動的切り替え
function switchTheme(themeId: string) {
  const theme = themes.find(t => t.id === themeId);
  if (theme) {
    theme.apply();
  }
}
```

## インストール

```bash
npm install @hierarchidb/tools-vite-plugin-package-reader
# または
pnpm add @hierarchidb/tools-vite-plugin-package-reader
# または
yarn add @hierarchidb/tools-vite-plugin-package-reader
```

## 基本的な使い方

### ステップ1: vite.config.tsに追加

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { vitePluginPackageReader, RegexStrategy } from '@hierarchidb/tools-vite-plugin-package-reader';

export default defineConfig({
  plugins: [
    vitePluginPackageReader({
      // パッケージ検出戦略を定義
      strategies: [
        new RegexStrategy({
          name: 'plugins',
          pattern: /^@myapp\/plugin-/,  // @myapp/plugin-* にマッチ
        })
      ],
      
      // Virtual Moduleを生成
      virtualModules: [{
        moduleId: 'my-plugins',
        generate: (packages) => {
          const imports = [];
          const exports = [];
          
          for (const [name, pkg] of packages) {
            const varName = name.replace('@myapp/plugin-', '').replace(/-/g, '_');
            imports.push(`import ${varName} from '${name}';`);
            exports.push(`  ${varName}`);
          }
          
          return `${imports.join('\n')}\n\nexport default [\n${exports.join(',\n')}\n];`;
        }
      }]
    })
  ]
});
```

### ステップ2: TypeScript定義を追加

```typescript
// src/vite-env.d.ts または src/types/virtual-modules.d.ts
declare module 'virtual:my-plugins' {
  interface Plugin {
    name: string;
    version: string;
    initialize(): void;
  }
  
  const plugins: Plugin[];
  export default plugins;
}
```

### ステップ3: アプリケーションで使用

```typescript
// src/main.ts
import plugins from 'virtual:my-plugins';

// すべてのプラグインを初期化
plugins.forEach(plugin => {
  console.log(`Initializing plugin: ${plugin.name}`);
  plugin.initialize();
});
```

## 高度な設定

### 複数の検出戦略を組み合わせる

```typescript
import { 
  RegexStrategy, 
  FieldStrategy, 
  CompositeStrategy,
  FunctionStrategy 
} from '@hierarchidb/tools-vite-plugin-package-reader';

vitePluginPackageReader({
  strategies: [
    // 戦略1: 名前パターンでマッチ
    new RegexStrategy({
      name: 'name-pattern',
      pattern: /^@myapp\/feature-/,
      metadataExtractor: (pkg) => ({
        category: 'feature',
        priority: pkg.priority || 100
      })
    }),
    
    // 戦略2: package.jsonのフィールドでマッチ
    new FieldStrategy({
      name: 'has-plugin-config',
      fields: ['myapp.plugin.enabled'],
      requireAll: true
    }),
    
    // 戦略3: カスタム関数でマッチ
    new FunctionStrategy({
      name: 'custom-logic',
      test: (name, pkg) => {
        // カスタムロジックで判定
        return pkg.keywords?.includes('myapp-extension') && 
               pkg.version.startsWith('2.');
      },
      getPriority: (name, pkg) => {
        // core パッケージを優先
        if (name.includes('core')) return 1;
        if (name.includes('addon')) return 100;
        return 50;
      }
    }),
    
    // 戦略4: 複合条件（AND/OR）
    new CompositeStrategy({
      name: 'premium-features',
      strategies: [
        new RegexStrategy({ name: 'premium', pattern: /premium|pro/ }),
        new FieldStrategy({ name: 'licensed', fields: ['license.valid'] }),
      ],
      mode: 'all', // すべての条件を満たす必要がある（'any'ならいずれか）
    })
  ]
});
```

### 変換パイプラインのカスタマイズ

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  pipeline: {
    // パッケージ情報を任意の形式に変換
    transform: (packages) => {
      const plugins = [];
      
      for (const [name, pkg] of packages) {
        plugins.push({
          id: name,
          name: pkg.displayName || name,
          version: pkg.version,
          description: pkg.description,
          icon: pkg.icon || 'default-icon.svg',
          config: pkg.myapp?.config || {},
          dependencies: Object.keys(pkg.dependencies || {}),
          loadPriority: pkg.myapp?.priority || 1000,
          lazy: pkg.myapp?.lazy || false,
        });
      }
      
      // 優先度でソート
      return plugins.sort((a, b) => a.loadPriority - b.loadPriority);
    }
  },
  
  virtualModules: [{
    moduleId: 'plugin-manifest',
    generate: (plugins) => {
      // 遅延ロード対応のマニフェストを生成
      const eager = plugins.filter(p => !p.lazy);
      const lazy = plugins.filter(p => p.lazy);
      
      return `
// 即座にロードするプラグイン
${eager.map(p => `import ${p.id.replace(/[@/-]/g, '_')} from '${p.id}';`).join('\n')}

export const eagerPlugins = [
  ${eager.map(p => p.id.replace(/[@/-]/g, '_')).join(',\n  ')}
];

// 遅延ロードするプラグイン
export const lazyPlugins = {
  ${lazy.map(p => `'${p.id}': () => import('${p.id}')`).join(',\n  ')}
};

export const manifest = ${JSON.stringify(plugins, null, 2)};
`;
    },
    
    generateTypes: (plugins) => {
      // TypeScript定義を自動生成
      return `
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon: string;
  config: Record<string, any>;
  dependencies: string[];
  loadPriority: number;
  lazy: boolean;
}

export const eagerPlugins: any[];
export const lazyPlugins: Record<string, () => Promise<any>>;
export const manifest: PluginManifest[];
`;
    }
  }]
});
```

### モノレポ固有の設定

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  monorepo: {
    // パッケージの場所を指定
    packages: [
      'packages/plugins/*',     // プラグインパッケージ
      'packages/features/*',    // 機能パッケージ
      'apps/*',                 // アプリケーション
      'services/*'              // サービス
    ],
    
    // pnpm workspace.yamlを使用
    usePnpmWorkspace: true,
    
    // workspace:プロトコルを解決
    resolveWorkspace: true,
  },
  
  // キャッシュ設定（大規模モノレポで有効）
  cache: true,
  cacheTTL: 5 * 60 * 1000, // 5分間キャッシュ
});
```

### フックを使用した拡張

```typescript
vitePluginPackageReader({
  strategies: [/* ... */],
  
  hooks: {
    // パッケージ検出前
    beforeDetection: async () => {
      console.log('🔍 パッケージをスキャン中...');
    },
    
    // パッケージ検出後
    afterDetection: async (packages) => {
      console.log(`✅ ${packages.size}個のパッケージを検出`);
      
      // バリデーション
      for (const [name, pkg] of packages) {
        if (!pkg.version) {
          console.warn(`⚠️ ${name} にバージョンがありません`);
        }
        
        // 必須フィールドのチェック
        if (!pkg.main && !pkg.module) {
          console.error(`❌ ${name} にエントリーポイントがありません`);
        }
      }
    },
    
    // 変換前にパッケージを修正
    beforeTransform: async (packages) => {
      for (const [name, pkg] of packages) {
        // デフォルト値を設定
        pkg.myapp = pkg.myapp || {};
        pkg.myapp.enabled = pkg.myapp.enabled ?? true;
        pkg.myapp.priority = pkg.myapp.priority ?? 1000;
        
        // 環境変数で特定のパッケージを無効化
        if (process.env[`DISABLE_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]) {
          packages.delete(name);
        }
      }
      return packages;
    },
    
    // 変換後の処理
    afterTransform: async (result) => {
      console.log(`📦 ${result.length}個のモジュールを生成`);
      return result;
    },
    
    // エラーハンドリング
    onError: (error, context) => {
      console.error(`エラーが発生しました (${context}):`, error);
      
      // エラー監視サービスに送信
      if (process.env.SENTRY_DSN) {
        // Sentry.captureException(error, { tags: { context } });
      }
    }
  }
});
```

## 実用的な例

### 例1: 機能フラグシステム

```typescript
// vite.config.ts
vitePluginPackageReader({
  strategies: [
    new FieldStrategy({
      name: 'feature-flags',
      fields: ['featureFlag'],
    })
  ],
  
  pipeline: {
    transform: (packages) => {
      const flags = {};
      
      for (const [name, pkg] of packages) {
        if (pkg.featureFlag) {
          const flag = pkg.featureFlag;
          flags[flag.id] = {
            enabled: flag.enabled ?? false,
            version: pkg.version,
            package: name,
            dependencies: flag.dependencies || [],
            rolloutPercentage: flag.rolloutPercentage || 0,
            allowedUsers: flag.allowedUsers || [],
            experiments: flag.experiments || {}
          };
        }
      }
      
      return flags;
    }
  },
  
  virtualModules: [{
    moduleId: 'feature-flags',
    generate: (flags) => {
      return `
const flags = ${JSON.stringify(flags, null, 2)};

export function isFeatureEnabled(flagId, userId = null) {
  const flag = flags[flagId];
  if (!flag) return false;
  
  // 基本的な有効/無効チェック
  if (!flag.enabled) return false;
  
  // ユーザー制限チェック
  if (userId && flag.allowedUsers.length > 0) {
    if (!flag.allowedUsers.includes(userId)) return false;
  }
  
  // ロールアウト率チェック
  if (flag.rolloutPercentage < 100) {
    const hash = userId ? hashCode(userId) : Math.random() * 100;
    if (hash > flag.rolloutPercentage) return false;
  }
  
  return true;
}

export function getFeatureConfig(flagId) {
  return flags[flagId] || null;
}

export function getAllFlags() {
  return Object.keys(flags);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}
`;
    }
  }]
});

// 使用例
import { isFeatureEnabled, getFeatureConfig } from 'virtual:feature-flags';

if (isFeatureEnabled('dark-mode', currentUser.id)) {
  enableDarkMode();
}

if (isFeatureEnabled('new-dashboard')) {
  const config = getFeatureConfig('new-dashboard');
  loadDashboard(config);
}
```

### 例2: APIエンドポイントの自動登録

```typescript
// vite.config.ts
vitePluginPackageReader({
  strategies: [
    new RegexStrategy({
      name: 'api-endpoints',
      pattern: /^@api\/endpoint-/,
    })
  ],
  
  pipeline: {
    transform: (packages) => {
      const endpoints = [];
      
      for (const [name, pkg] of packages) {
        if (pkg.api?.endpoints) {
          for (const endpoint of pkg.api.endpoints) {
            endpoints.push({
              ...endpoint,
              package: name,
              version: pkg.version,
              middleware: endpoint.middleware || [],
              rateLimit: endpoint.rateLimit || { requests: 100, window: 60 }
            });
          }
        }
      }
      
      // パスでグループ化
      const grouped = {};
      for (const endpoint of endpoints) {
        const base = endpoint.path.split('/')[1] || 'root';
        grouped[base] = grouped[base] || [];
        grouped[base].push(endpoint);
      }
      
      return grouped;
    }
  },
  
  virtualModules: [{
    moduleId: 'api-routes',
    generate: (grouped) => {
      return `
import { Router } from 'express';

export function registerRoutes(app) {
  ${Object.entries(grouped).map(([base, endpoints]) => `
  // ${base} routes
  const ${base}Router = Router();
  ${endpoints.map(e => `
  ${base}Router.${e.method}('${e.path}', 
    ...${JSON.stringify(e.middleware)}.map(m => require(m)),
    require('${e.package}').${e.handler}
  );`).join('')}
  app.use('/${base}', ${base}Router);
  `).join('\n')}
}

export const endpoints = ${JSON.stringify(grouped, null, 2)};
`;
    }
  }]
});
```

### 例3: 国際化（i18n）リソースの統合

```typescript
// vite.config.ts
vitePluginPackageReader({
  strategies: [
    new FieldStrategy({
      name: 'i18n-resources',
      fields: ['i18n.translations'],
    })
  ],
  
  pipeline: {
    transform: (packages) => {
      const translations = {
        ja: {},
        en: {},
        zh: {}
      };
      
      for (const [name, pkg] of packages) {
        if (pkg.i18n?.translations) {
          for (const [lang, messages] of Object.entries(pkg.i18n.translations)) {
            translations[lang] = {
              ...translations[lang],
              [pkg.i18n.namespace || name]: messages
            };
          }
        }
      }
      
      return translations;
    }
  },
  
  virtualModules: [{
    moduleId: 'i18n-resources',
    generate: (translations) => {
      return `
export const resources = ${JSON.stringify(translations, null, 2)};

export const supportedLanguages = ${JSON.stringify(Object.keys(translations))};

export function getTranslation(lang, namespace, key) {
  return resources[lang]?.[namespace]?.[key] || key;
}

export function getAllTranslations(lang) {
  return resources[lang] || {};
}
`;
    }
  }]
});
```

## パフォーマンスの最適化

### キャッシュの設定

```typescript
vitePluginPackageReader({
  cache: true,  // キャッシュを有効化
  cacheTTL: 60000, // 1分間キャッシュ（ミリ秒）
  
  strategies: [/* ... */],
  
  // 大規模プロジェクトでの最適化
  logger: {
    level: 'warn', // ログを最小限に
  }
});
```

### 開発時と本番環境の設定分離

```typescript
const isDev = process.env.NODE_ENV === 'development';

vitePluginPackageReader({
  // 開発時のみファイル監視
  watch: isDev,
  
  // 本番環境では警告以上のみログ出力
  logger: {
    level: isDev ? 'info' : 'warn',
  },
  
  // 開発時は短めのキャッシュ
  cache: true,
  cacheTTL: isDev ? 10000 : 300000, // 開発: 10秒、本番: 5分
  
  strategies: [/* ... */]
});
```

## トラブルシューティング

### パッケージが検出されない場合

```typescript
// デバッグモードを有効にして詳細を確認
vitePluginPackageReader({
  logger: {
    level: 'debug',
    prefix: '[DEBUG]',
  },
  
  hooks: {
    afterDetection: async (packages) => {
      console.log('検出されたパッケージ:');
      for (const [name, pkg] of packages) {
        console.log(`  - ${name} v${pkg.version}`);
      }
    }
  },
  
  strategies: [/* ... */]
});
```

### Virtual Moduleが見つからない場合

1. `virtual:`プレフィックスを忘れていないか確認
2. TypeScript定義ファイルに宣言を追加
3. Viteサーバーを再起動

```typescript
// 正しい使い方
import data from 'virtual:my-module';  // ✅

// 間違った使い方
import data from 'my-module';          // ❌
```

### HMRが動作しない場合

```typescript
vitePluginPackageReader({
  watch: true,  // 明示的に有効化
  
  hooks: {
    afterDetection: async (packages) => {
      // 変更を検出したらログ出力
      console.log(`[HMR] ${new Date().toISOString()} - パッケージを再検出`);
    }
  },
  
  strategies: [/* ... */]
});
```

## ベストプラクティス

### 1. 戦略の命名規則

```typescript
// 良い例：具体的で分かりやすい名前
new RegexStrategy({
  name: 'ui-components',  // ✅
  pattern: /^@myapp\/ui-/
});

// 悪い例：曖昧な名前
new RegexStrategy({
  name: 'strategy1',  // ❌
  pattern: /^@myapp\/ui-/
});
```

### 2. エラーハンドリング

```typescript
vitePluginPackageReader({
  hooks: {
    onError: (error, context) => {
      // 開発時は詳細なエラー情報を表示
      if (process.env.NODE_ENV === 'development') {
        console.error(`詳細なエラー情報 (${context}):`, error.stack);
      } else {
        // 本番環境では簡潔に
        console.error(`エラー: ${error.message}`);
      }
    }
  },
  
  strategies: [/* ... */]
});
```

### 3. 型安全性の確保

```typescript
// types/virtual-modules.d.ts
declare module 'virtual:*' {
  // 基本的な型定義
  const content: any;
  export default content;
}

// より具体的な型定義
declare module 'virtual:plugin-definitions' {
  export interface PluginDefinition {
    name: string;
    version: string;
    load(): Promise<any>;
  }
  
  const definitions: PluginDefinition[];
  export default definitions;
}
```

## ライセンス

MIT

## 貢献

Issue報告やPull Requestを歓迎します。

[GitHub Repository](https://github.com/hierarchidb/hierarchidb)