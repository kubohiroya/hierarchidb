# @hierarchidb/runtime-plugin-registry

Worker側で動作するプラグインレジストリシステム。デザインパターンに基づいた明確な責務分離により、プラグインの探索から初期化、提供までの全フローを管理します。

## アーキテクチャ

### 処理フロー

```
1. Discovery (探索)
   ↓
2. Definition (定義作成)
   ↓
3. Resolution (依存関係解決)
   ↓
4. Initialization (初期化)
   ↓
5. Repository (保存)
   ↓
6. Facade (API提供)
```

### ディレクトリ構造とデザインパターン

```
src/
├── 1-discovery/          # Strategy Pattern
│   ├── PluginDiscoveryStrategy.ts
│   └── PackageJsonDiscoveryStrategy.ts
│
├── 2-definition/         # Factory & Builder Pattern
│   └── PluginDefinitionFactory.ts
│
├── 3-resolution/         # Algorithm (Topological Sort)
│   └── DependencyResolver.ts
│
├── 4-initialization/     # Template Method Pattern
│   └── PluginInitializer.ts
│
├── 5-repository/         # Repository Pattern
│   └── PluginRepository.ts
│
├── 6-facade/            # Facade Pattern
│   ├── PluginRegistryFacade.ts
│   └── PluginEventEmitter.ts
│
└── orchestrator/        # Orchestration
    ├── PluginOrchestrator.ts
    └── WorkerPluginBootstrapper.ts
```

## 使用方法

### Worker側での初期化

```typescript
import {
  initializePluginSystemInWorker,
  PackageJsonDiscoveryStrategy,
} from '@hierarchidb/runtime-plugin-registry';

// Worker環境でプラグインシステムを初期化
const api = await initializePluginSystemInWorker({
  discoveryStrategy: new PackageJsonDiscoveryStrategy(),
  debug: true,
  autoInitialize: true,
  onReady: (api) => {
    console.log('Plugin system ready');
  },
  onError: (error) => {
    console.error('Plugin initialization failed:', error);
  },
});

// プラグインを取得
const folderPlugin = api.get('folder');
const handler = api.getHandler('folder');

// 作成メニュー用のリストを取得
const createMenuItems = api.getForCreateMenu();
```

### カスタム探索戦略

```typescript
class CustomDiscoveryStrategy extends BasePluginDiscoveryStrategy {
  async discover(): Promise<PluginManifest[]> {
    // カスタム探索ロジック
    return [];
  }
  
  getName(): string {
    return 'CustomStrategy';
  }
}
```

## 主要コンポーネント

### 1. Discovery (探索)
- **責務**: プラグインパッケージを探索してマニフェスト情報を収集
- **パターン**: Strategy Pattern
- **実装**: `PackageJsonDiscoveryStrategy`

### 2. Definition (定義作成)
- **責務**: マニフェストからPluginDefinitionを生成
- **パターン**: Factory & Builder Pattern
- **実装**: `PluginDefinitionFactory`, `PluginDefinitionBuilder`

### 3. Resolution (依存関係解決)
- **責務**: プラグイン間の依存関係を解決し、初期化順序を決定
- **アルゴリズム**: Topological Sort (Kahn's algorithm)
- **実装**: `DependencyResolver`, `TopologicalSorter`

### 4. Initialization (初期化)
- **責務**: プラグインを初期化してPluginIntegratedを生成
- **パターン**: Template Method Pattern
- **実装**: `StandardPluginInitializer`

### 5. Repository (リポジトリ)
- **責務**: 初期化済みプラグインを保存・検索
- **パターン**: Repository Pattern
- **実装**: `PluginRepository`, `PluginStore`

### 6. Facade (ファサード)
- **責務**: 外部向けの統一APIを提供
- **パターン**: Facade Pattern
- **実装**: `PluginRegistryFacade`, `PluginProviderAPI`

## API

### PluginProviderAPI

```typescript
interface PluginProviderAPI {
  // プラグインを取得
  get(nodeType: NodeType): PluginIntegrated | null;
  
  // すべてのプラグインを取得
  getAll(): PluginIntegrated[];
  
  // エンティティハンドラーを取得
  getHandler(nodeType: NodeType): EntityHandler | null;
  
  // 作成メニュー用リストを取得
  getForCreateMenu(): CreateMenuItem[];
  
  // 存在確認
  has(nodeType: NodeType): boolean;
  
  // 利用可能性確認
  isAvailable(nodeType: NodeType): boolean;
}
```

## イベント

```typescript
// イベントリスナー登録
api.on('plugin-initialized', (payload) => {
  console.log(`Plugin ${payload.nodeType} initialized`);
});

// 利用可能なイベント
- 'plugin-loaded'
- 'plugin-initialized'
- 'plugin-error'
- 'cache-cleared'
- 'all-plugins-loaded'
```