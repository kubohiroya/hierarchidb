# HierarchiDB Repository Map (2025-09-25)

```mermaid
mindmap
  root((HierarchiDB Repository Map))
    App (現在稼働系)
      config & build
        package.json / tsconfig.* / vite.*: アプリ固有設定
        scripts: ビルド・自動生成系
        docs: アプリ運用メモ
      src
        components: 共通 UI（dialogs, trash 等）
        contexts: WorkerProvider などアプリ用 Context
        hooks: 再利用 Hooks（treeconsole 系など）
        init / services / utils / shared: 初期化ロジック・サービス層・共通ユーティリティ
        pages / routes: React Router 構成
        worker-runtime: WorkerModuleLoader / StateStore (最新 Proxy 基盤)
        subscriptions / state: Jotai 等の状態管理
        virtual: Storybook 等のスタブ類
        generated: 自動生成ファイル群
    Packages (モノレポ機能群)
      plugins
        basemap / folder / route / spreadsheet / resolver / styler / shape / location / timeline / linker: 各 NodeType プラグイン
          src
            components / ui: プラグイン固有 UI
            worker: Dexie peer 登録・Worker エントリ
            services / handlers / entities: ドメインロジック
            docs: 実装仕様（一部のプラグインのみ）
      runtime-ui
        datasource: ライセンス確認ダイアログ等、共通 UI コンポーネント
        plugin-dialog / landingpage / tour...: ランタイム UI コア
      runtime-worker
        worker: WorkerService 実装
        worker-bootstrap: WorkerInitializationChannel 等
      runtime-shared
        module-paths: importRuntimeWorker / プラグインモジュール ID
        client / fetch-metadata など: 共有ユーティリティ
      common / util / ui / tools / backend / feature: 共通 API・型・UI コンポーネント・ビルド/CI ツール群
    Reference (旧実装・参考資産)
      app
        src
          domains / shared: 旧 UI 構成。ライセンス/データソースフローなどの土台実装が残存
      app0
        src
          components / features / shared: 大規模な UI・機能サンプル（TreeConsole やバッチ導線などの原型）
      packages
        core / api / worker / common 等: 旧のサービス/Worker 実装
      docs / scripts / data: 旧仕様書・サンプルデータ・補助スクリプト
```

> NOTE: This map captures the directory landscape at a high level. Use it as the starting point for deeper, feature-specific inventories (UI library reuse, worker integration, reference asset migration, etc.).

## Target Architecture Map (Dynamic Imports & Worker Reorganization)

```mermaid
mindmap
  root((Dynamic Import Architecture))
    UI Shell (app)
      WorkerRuntimeProvider (Suspense bridge　PLAN)
      WorkerState hooks / proxy store [DONE]
      Dialog orchestration → runtime-ui/datasource [PLAN]
      Batch dashboards (timeline/location　PLAN)
    Worker Platform (runtime)
      WorkerModuleLoader (central dynamic import　DONE)
      WorkerStateStore (state machine　DONE)
      WorkerAPIClient shim → proxy forwarding [PLAN]
      InitializationChannel (progress events　DONE)
    Plugin Workers (monorepo)
      Core node-types (basemap/folder/route/spreadsheet/resolver/styler/shape　DONE)
        load*EntitiesDbModule helpers + storeRegistry registration
      Location worker [PLAN]
        Dexie preload整備・batch adapters連携
      Timeline worker [PLAN]
        Live map/vector tile playback via shared ui-map components
      Worker package layout [PLAN]
        Consider consolidating heavy worker code under packages/workers/*
    Shared UI / Services
      runtime-ui/datasource (license dialogs　DONE)
      runtime-ui/plugin-dialog (step registry　PLAN)
      @hierarchidb/ui-map integration for timeline/location previews [PLAN]
      Batch pipeline adapters (timeline/location/shape　PLAN)
    Legacy assets (reference)
      app / app0 [PLAN]
        Migrate dialog + batch UI modules into runtime-ui / plugin packages
      packages/core/api/worker [PLAN]
        Fold legacy services into runtime-worker & runtime-shared
```

Note:
- `[DONE]` = already aligned with the new dynamic-import architecture, `[PLAN]` = scheduled refactor, `[TODO]` = 未整備箇所。
- Worker 周辺は `WorkerModuleLoader` と `WorkerStateStore` を中心に再構成し、各プラグインは非同期ロード用のファクトリ (`load*EntitiesDbModule`) を提供する必要があります。
- Timeline / Location のワーカーは引き続き UI-map や Dexie 連携を進め、`packages/plugins/dialog-impl-status.md` など既存メモを参照しながら実装を移行します。
