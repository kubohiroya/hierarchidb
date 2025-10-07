# AOP プラグインアーキテクチャ 要件定義書

## 概要

本書は、hierarchidbのAOP（アスペクト指向プログラミング）によるプラグインアーキテクチャの要件定義書である。ベースモジュールに対して、クロスカット・ジョインポイントを用いた機能拡張を可能にする仕組みを定義する。

## 関連文書

- **ユーザストーリー**: [📖 aop-plugin-architecture-user-stories.md](aop-plugin-architecture-user-stories.md)
- **受け入れ基準**: [✅ aop-plugin-architecture-acceptance-criteria.md](aop-plugin-architecture-acceptance-criteria.md)
- **Worker実装要件**: [🔧 worker-implementation-requirements.md](worker-implementation-requirements.md)

## 機能要件（EARS記法）

### 通常要件

🟢 **プラグインシステム基盤**
- REQ-AOP-001: システムは Worker層のAPIサービスにクロスカット・ジョインポイントを提供しなければならない
- REQ-AOP-002: システムは ノードのライフサイクルイベントに対してフックを提供しなければならない
- REQ-AOP-003: システムは プラグインの登録・解除を動的に行えなければならない
- REQ-AOP-004: システムは プラグイン間の依存関係を解決できなければならない

🟢 **エンティティ管理**
- REQ-AOP-005: システムは ノードに紐づけたエンティティの作成・更新・削除を管理しなければならない
- REQ-AOP-006: システムは エンティティおよびサブエンティティの型定義を拡張可能にしなければならない
- REQ-AOP-007: システムは エンティティのライフサイクルをノードと同期しなければならない

🟢 **API拡張**
- REQ-AOP-008: システムは エンティティ種別ごとに追加APIを定義できなければならない
- REQ-AOP-009: システムは 既存APIの前後に処理を挿入できなければならない
- REQ-AOP-010: システムは APIの戻り値を変換・拡張できなければならない

### 条件付き要件

🟢 **ジョインポイント実行**
- REQ-AOP-101: ノード作成時、システムは 登録された全てのbeforeCreateフックを実行しなければならない
- REQ-AOP-102: ノード更新時、システムは 登録された全てのbeforeUpdateフックを実行しなければならない
- REQ-AOP-103: ノード削除時、システムは 登録された全てのbeforeDeleteフックを実行しなければならない
- REQ-AOP-104: 処理成功時、システムは 登録された全てのafterSuccessフックを実行しなければならない
- REQ-AOP-105: エラー発生時、システムは 登録された全てのonErrorフックを実行しなければならない

🟡 **プラグイン固有処理**
- REQ-AOP-106: ツリー種別がResourcesの場合、システムは 地理情報系プラグインを有効化しなければならない
- REQ-AOP-107: ツリー種別がProjectsの場合、システムは プロジェクト管理系プラグインを有効化しなければならない
- REQ-AOP-108: ノード種別がbasemapの場合、システムは MapLibreGLJS連携処理を実行しなければならない

### 状態要件

🟢 **プラグイン状態管理**
- REQ-AOP-201: プラグインが有効な場合、システムは そのプラグインのフックを実行しなければならない
- REQ-AOP-202: プラグインが無効な場合、システムは そのプラグインのフックをスキップしなければならない
- REQ-AOP-203: プラグインがエラー状態の場合、システムは そのプラグインを自動的に無効化しなければならない

### オプション要件

🟡 **プラグイン開発支援**
- REQ-AOP-301: システムは プラグイン開発用のテンプレートを提供してもよい
- REQ-AOP-302: システムは プラグインのホットリロードをサポートしてもよい
- REQ-AOP-303: システムは プラグインのデバッグツールを提供してもよい

### 制約要件

🟢 **プラグイン実行制約**
- REQ-AOP-401: システムは プラグインの実行順序を保証しなければならない
- REQ-AOP-402: システムは プラグインの実行時間を制限しなければならない（タイムアウト: 1000ms）
- REQ-AOP-403: システムは プラグインのメモリ使用量を制限しなければならない（上限: 50MB/プラグイン）
- REQ-AOP-404: システムは ベースモジュールのコア機能を破壊から保護しなければならない

## アーキテクチャ設計

### プラグインシステム構成

```typescript
// Worker層のプラグインインターフェース
interface WorkerPlugin {
  name: string;
  version: string;
  dependencies?: string[];
  
  // ライフサイクルフック
  hooks?: {
    beforeCreate?: (context: HookContext) => Promise<void>;
    afterCreate?: (context: HookContext) => Promise<void>;
    beforeUpdate?: (context: HookContext) => Promise<void>;
    afterUpdate?: (context: HookContext) => Promise<void>;
    beforeDelete?: (context: HookContext) => Promise<void>;
    afterDelete?: (context: HookContext) => Promise<void>;
    onError?: (error: Error, context: HookContext) => Promise<void>;
  };
  
  // API拡張
  apiExtensions?: {
    [methodName: string]: APIExtension;
  };
  
  // エンティティ定義
  entities?: {
    [entityType: string]: EntityDefinition;
  };
}

// フックコンテキスト
interface HookContext {
  nodeId: TreeNodeId;
  nodeType: TreeNodeType;
  treeType?: string; // "Resources" | "Projects" など
  data: any;
  db: {
    core: CoreDB;
    ephemeral: EphemeralDB;
  };
  api: WorkerAPI;
}

// API拡張定義
interface APIExtension {
  before?: (args: any[]) => Promise<any[]>;
  after?: (result: any) => Promise<any>;
  replace?: (args: any[]) => Promise<any>;
}

// エンティティ定義
interface EntityDefinition {
  schema: object; // JSON Schema
  hooks?: {
    onCreate?: (entity: any) => Promise<void>;
    onUpdate?: (entity: any) => Promise<void>;
    onDelete?: (entityId: string) => Promise<void>;
  };
  subEntities?: {
    [subEntityType: string]: SubEntityDefinition;
  };
}
```

### プラグイン登録メカニズム

```typescript
// Worker初期化時のプラグイン登録
class PluginManager {
  private plugins: Map<string, WorkerPlugin> = new Map();
  private hookChains: Map<string, Function[]> = new Map();
  
  // プラグイン登録
  async register(plugin: WorkerPlugin): Promise<void> {
    // 依存関係チェック
    await this.checkDependencies(plugin);
    
    // フック登録
    this.registerHooks(plugin);
    
    // API拡張登録
    this.registerAPIExtensions(plugin);
    
    // エンティティ定義登録
    this.registerEntities(plugin);
    
    this.plugins.set(plugin.name, plugin);
  }
  
  // フック実行
  async executeHooks(hookName: string, context: HookContext): Promise<void> {
    const hooks = this.hookChains.get(hookName) || [];
    for (const hook of hooks) {
      await hook(context);
    }
  }
}
```

## 非機能要件

### パフォーマンス

🟢 **プラグイン実行性能**
- NFR-AOP-001: プラグインフックの実行オーバーヘッドは10ms以内
- NFR-AOP-002: プラグイン登録は100ms以内に完了
- NFR-AOP-003: 10個のプラグインを同時に有効化しても性能劣化なし

### 拡張性

🟢 **プラグイン互換性**
- NFR-AOP-101: 新バージョンでも既存プラグインが動作すること（後方互換性）
- NFR-AOP-102: プラグインAPIの破壊的変更は最小限に抑える
- NFR-AOP-103: プラグイン間の相互運用性を保証

### 保守性

🟡 **プラグイン管理**
- NFR-AOP-201: プラグインのバージョン管理が可能
- NFR-AOP-202: プラグインのログとデバッグ情報を収集可能
- NFR-AOP-203: プラグインの自動テストが実行可能

## 具体的な拡張例

### 地理情報プラグイン（Resources ツリー用）

🟡 **basemap プラグイン**
```typescript
const basemapPlugin: WorkerPlugin = {
  name: 'basemap',
  version: '1.0.0',
  
  entities: {
    basemap: {
      schema: {
        type: 'object',
        properties: {
          style: { type: 'string' },
          center: { type: 'array' },
          zoom: { type: 'number' }
        }
      },
      hooks: {
        onCreate: async (entity) => {
          // MapLibreGLJS設定の初期化
        }
      }
    }
  },
  
  hooks: {
    afterCreate: async (context) => {
      if (context.nodeType === 'basemap') {
        // 地図レイヤーの初期化処理
      }
    }
  }
};
```

### プロジェクト管理プラグイン（Projects ツリー用）

🟡 **project プラグイン**
```typescript
const projectPlugin: WorkerPlugin = {
  name: 'project',
  version: '1.0.0',
  
  apiExtensions: {
    aggregateResources: {
      replace: async (args) => {
        // Resourcesツリーのノードを参照・集約
        const [projectId] = args;
        // 階層的に定義された地図要素を集約
        return aggregatedData;
      }
    }
  }
};
```

## Edgeケース

### プラグインエラー処理

🟡 **プラグイン実行エラー**
- EDGE-AOP-001: プラグインが例外を投げた場合、他のプラグインの実行を継続する
- EDGE-AOP-002: プラグインがタイムアウトした場合、強制終了して次の処理へ
- EDGE-AOP-003: プラグインが無限ループした場合、検出して中断

### 依存関係の循環

🔴 **循環依存**
- EDGE-AOP-101: プラグインAがBに依存し、BがAに依存する場合、エラーを返す
- EDGE-AOP-102: 依存チェーンが10段階を超える場合、警告を表示

## プラグイン導入方法

🟢 **導入手順**
1. ソースコードのGitHubからのclone
2. 拡張モジュールのNPM化
3. 拡張モジュールのpackage.jsonへのdependencies追加
4. ビルド

```json
// package.json
{
  "dependencies": {
    "@hierarchidb/plugin-basemap": "^1.0.0",
    "@hierarchidb/plugin-project": "^1.0.0"
  }
}
```

```typescript
// src/src/plugin-loader/openstreetmap-type.ts
import { basemapPlugin } from '@hierarchidb/plugin-basemap';
import { projectPlugin } from '@hierarchidb/plugin-project';

export const plugins = [
  basemapPlugin,
  projectPlugin
];
```