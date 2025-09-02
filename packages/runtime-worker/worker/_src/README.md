# @hierarchidb/runtime-worker

Worker側で動作するランタイムパッケージ。プラグインシステムの初期化、データベース管理、API実装を提供します。

## アーキテクチャ

### 初期化フロー

```
1. WorkerEntryPoint (worker.ts)
   ↓
2. WorkerBootstrapper
   ↓
3. 初期化フェーズ実行
   - Phase 1: Environment (環境準備)
   - Phase 2: Database (DB初期化)
   - Phase 3: Plugins (プラグイン初期化)
   - Phase 4: Services (コアサービス)
   - Phase 5: API (API実装作成)
   - Phase 6: Expose (Comlink公開)
   ↓
4. Worker Ready
```

### ディレクトリ構造

```
src/
├── 1-bootstrap/              # ブートストラップ層
│   ├── WorkerEntryPoint.ts     # エントリーポイント
│   ├── WorkerBootstrapper.ts   # メインブートストラッパー
│   ├── InitializationSequence.ts # シーケンス管理
│   └── BootstrapConfig.ts      # 設定定義
│
├── 2-database/               # データベース層
│   ├── DatabaseInitializer.ts  # DB初期化
│   ├── CoreDatabaseManager.ts  # CoreDB管理
│   └── EphemeralDatabaseManager.ts # EphemeralDB管理
│
├── 3-plugin-system/          # プラグインシステム層
│   ├── PluginSystemInitializer.ts # システム初期化
│   ├── PluginDiscoveryService.ts  # プラグイン探索
│   └── PluginDatabaseInitializer.ts # プラグインDB初期化
│
├── 4-core-services/          # コアサービス層
│   ├── TreeService.ts          # ツリー操作
│   ├── NodeService.ts          # ノード操作
│   ├── EntityService.ts        # エンティティ操作
│   └── CommandService.ts       # コマンド実行
│
├── 5-api-implementation/     # API実装層
│   ├── WorkerAPIImpl.ts        # API実装
│   ├── APIMethodRegistry.ts    # メソッド登録
│   └── ComlinkExposer.ts       # Comlink公開
│
└── 6-operations/             # 業務ロジック層
    ├── TreeOperations.ts       # ツリー操作実装
    ├── NodeOperations.ts       # ノード操作実装
    └── EntityOperations.ts     # エンティティ操作実装
```

## 使用方法

### Worker側での起動

```typescript
// worker.ts (エントリーポイント)
import './1-bootstrap/WorkerEntryPoint';
```

WorkerEntryPointが自動的に以下を実行：
1. 設定の読み込み
2. WorkerBootstrapperの起動
3. 全フェーズの初期化
4. Comlink経由でのAPI公開

### UI側からの接続

UI側は別パッケージ（`@hierarchidb/runtime-client`）から接続：

```typescript
import { WorkerClient } from '@hierarchidb/runtime-client';

const client = new WorkerClient();
const api = await client.connect();

// APIを使用
const tree = await api.getTree('tree-id');
```

## 初期化フェーズ詳細

### Phase 1: Environment（環境準備）
- IndexedDBの利用可能性確認
- Comlinkの準備
- グローバル設定の適用

### Phase 2: Database（データベース初期化）
- CoreDB（永続化データ）の初期化
- EphemeralDB（一時データ）の初期化
- スキーマのマイグレーション

### Phase 3: Plugins（プラグインシステム）
- package.jsonからプラグイン探索
- プラグイン定義の作成
- 依存関係の解決
- プラグインごとのDB初期化

### Phase 4: Services（コアサービス）
- TreeServiceの初期化
- NodeServiceの初期化
- EntityServiceの初期化
- CommandServiceの初期化

### Phase 5: API（API実装）
- WorkerAPIImplの作成
- サービスとの連携設定
- メソッドの登録

### Phase 6: Expose（公開）
- Comlink.exposeでAPI公開
- メインスレッドへの準備完了通知

## 設定

```typescript
interface BootstrapConfig {
  debug?: boolean;
  
  database?: {
    coreName?: string;        // デフォルト: 'hierarchidb-core'
    ephemeralName?: string;   // デフォルト: 'hierarchidb-ephemeral'
    version?: number;         // デフォルト: 1
  };
  
  plugins?: {
    autoDiscover?: boolean;   // デフォルト: true
    discoveryStrategy?: string; // デフォルト: 'package-json'
  };
  
  services?: {
    enableCache?: boolean;    // デフォルト: true
    enableValidation?: boolean; // デフォルト: true
  };
}
```

## エラーハンドリング

各フェーズでエラーが発生した場合：
1. エラーログを出力
2. メインスレッドにエラー通知
3. Workerを安全に終了

## デバッグ

デバッグモードを有効にすると、各フェーズの詳細ログが出力されます：

```typescript
const config: BootstrapConfig = {
  debug: true, // または process.env.NODE_ENV === 'development'
};
```

ログ例：
```
[2024-01-01T00:00:00.000Z] [WorkerBootstrapper] ===== Worker Bootstrap Starting =====
[2024-01-01T00:00:00.100Z] [WorkerBootstrapper] Phase 1: Preparing environment...
[2024-01-01T00:00:00.150Z] [InitializationSequence] Starting phase: environment
[2024-01-01T00:00:00.200Z] [InitializationSequence] Phase environment completed in 50ms
...
```