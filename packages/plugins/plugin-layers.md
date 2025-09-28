# プラグイン層アーキテクチャ図

以下では、プラグイン実装に関わる 6 層を色分けし、現状の構成と理想的な共通アーキテクチャ像を整理します。

## 凡例
- 🟥 UI ホスト層 (a)
- 🟧 UI プラグイン層／プロキシーファクトリ (b)
- 🟨 Worker 共通フレームワーク (c)
- 🟩 Worker プラグイン固有サービス (d)
- 🟦 Worker データベース／スキーマ (e)
- 🟪 孫 Worker（バッチ処理用 Comlink ワーカー）(f)

---

## 現状: shape プラグイン
```
🟥 App Shell / RuntimeWiring
   │  registerRuntimeWorkerAdapters (flag)
   ▼
🟧 ShapeRuntimeWorkerClient (薄いファクトリ)
   │  ↳ registerShapeRuntimeWorkerClient()
   ▼
🟨 runtime-worker StageProcessingService (getStageProcessingClient)
   │  ↳ singleton fallback
   └─(flag ON)→ createStageWorkerClient() → Comlink wrap
          │
          ▼
🟪 stageWorker.entry.js (孫Worker)
   │  exposes download/simplify/vectortile
   ▼
🟩 Shape SessionController / EntityHandler
   │  call client.download/simplify/…
   ▼
🟦 Shape Dexie DB 群
```

## 現状: location プラグイン
```
🟥 App Shell / RuntimeWiring
   │  registerLocationRuntimeWorkerAdapters (flag)
   ▼
🟧 (欠如) — 直接呼び出し
   │
   ▼
🟨 runtime-worker StageProcessingService
   │  getStageProcessingClient() 直呼び
   └─(flag ON)→ createStageWorkerClient() 呼ぶだけ（戻り値未配線）
          │
          ▼
🟪 stageWorker.entry.js
   │  vectortile API 提供
   ▼
🟩 Location SessionController
   │  getStageProcessingClient() を毎回取得
   ▼
🟦 Location Dexie DB 群
```

## 現状: route プラグイン
```
🟥 App Shell / RuntimeWiring
   │  registerRouteRuntimeWorkerAdapters (flag)
   ▼
🟧 (欠如) — プレースホルダのみ
   │
   ▼
🟨 runtime-worker StageProcessingService
   │  createStageWorkerClient() 呼ぶのみ
   └─戻り値未利用
          │
          ▼
🟪 stageWorker.entry.js
   │
   ▼
🟩 Route BatchManager / EntityHandler / Lifecycle
   │  既存処理は同期ルートのみ
   ▼
🟦 Route Dexie DB 群
```

## 理想像: プラグイン共通アーキテクチャ
```
🟥 App Shell / RuntimeWiring
   │  ├─ load PluginDefinition (flag 判定)
   │  └─ RuntimeWorkerFactory.register(nodeType, factory)
   ▼
🟧 PluginRuntimeWorkerFactory (共通)
  │  ├─ getClient(nodeType) -> StageProcessingFacade
  │  └─ registerAdapter(nodeType, provider)
   ▼
🟨 runtime-worker Bootstrap (wirePluginsFromModules)
   │  ├─ registerRuntimeExports(nodeType, { createEntityHandler, createBatchManager, lifecycle })
   │  └─ expose StageProcessingService API
   ▼
🟩 Plugin Worker Services
   │  ├─ EntityHandler / BatchManager (Comlink 対応)
   │  └─ Lifecycle hooks
   ▼
🟦 Plugin Dexie Schemas
   │  └─ storeRegistry.registerPeer(nodeType, schema)
   ▼
🟪 Stage Worker (孫Worker)
   │  ├─ Comlink.expose({ download, simplify, vectortile, … })
   │  └─ 共通 StageProcessingService 実装
```

---

## 次のアクション指針
1. プラグインごとに欠落している層（特に 🟧 層）に空のファクトリコードを配置し、処理の流れを結線する。
2. 共通となるファクトリ API を整備し、各プラグインで横展開する。
3. Worker 側の `wirePluginsFromModules` で取得するエクスポートを標準化し、RuntimeWorkerFactory と連携させる。
