## Primary Directive

- Think in English, interact with the user in Japanese.
- ソースコードのコメントおよびドキュメントは英語で記述する。
- TASKS.mdは日本語で記述する。
- そのほか、ユーザーが特に求めた場合にはドキュメントは日本語版を作成してもよいものとする。

## このファイル（AGNETS.md）のメンテナンス_ポリシー（Maintenance policy）

- 会話の中で繰り返し指示された事柄について、このファイルへの反映を検討すること
- このファイルにおいて、冗長だったり圧縮の余地がある箇所がないか検討し、必要に応じて更新すること
- 簡潔でありながら密度の濃い文書にすること
- 不具合対応では「原因・発生範囲の確認内容・修正方法と適用範囲」を明確に説明し、完了報告に必ず含めること（説明抜けを防止するルールとする）

# ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in PLANS.md) from design to implementation.

## Project Structure & Module Organization
The workspace relies on `pnpm`. `app/` contains the main UI, with shared documentation in `app/docs/`. Core libraries live in `packages/` (runtime services, UI components, tooling), feature plugins in `plugins/`, and shared assets inside `docs/`, `reports/`, or package-level `dist/`. Tests are colocated: unit suites in `packages/*/src/__tests__/`, worker flows in `packages/runtime-worker/src/__tests__/wfl/`, and Playwright smoke tests in `e2e/`.

- **モノレポ構成の現況（2025-11 調査メモ）**
  - `app/` は React + Vite シェルとドキュメント (`app/docs/`) に加えて、プラグイン定義をローディングする `app/src/plugin-registry` や Worker エントリ (`app/src/worker-runtime/worker.ts`) を内包し、UI から Worker までを 1 つのパッケージで束ねている。`plugin-registry/preconnect.ts` は `@hierarchidb/plugin-registry` が提供する `pluginRegistry` を `import.meta.glob` で解決し、UI/Worker/Icon ローダーを同時に export する。
  - `packages/runtime`（UI/Worker 共有 API 群）・`packages/runtime-worker`（DI+Comlink で Worker サービスを構築）を頂点に、`packages/plugin-service-sdk`（`getWorkerBridge()` と WorkerProvider 連携）、`packages/plugin-ui-host`（MultiStep dialog + `useWorkerSync`）、`packages/plugin-base`（共通エンティティハンドラ）、`packages/plugin-service-api` / `plugin-ui-sdk` などが UI と Worker の橋渡しを担う。
  - `packages/plugin-registry` と `pnpm tools:gen-plugin-registry`（`package.json` script）が `plugins/*-plugin` 配下の `hierarchidb.plugin` メタデータ・Dexie schema・UI/Worker エントリパスを集計し、`pluginRegistry`/`pluginDefinitions` を dist・`app/src/plugin-registry` 双方へ同期する。新規プラグイン追加時は Kanban/TASKS.md と同時にこのコマンドを実行する。
  - `plugins/` 直下には folder/location/shape/... の各ノードタイプが pnpm パッケージとして存在し、`src/{ui,worker,shared,icon}` と Dexie schema を同居させる（`plugins/README.md` の比較表・3 層図を参照）。`package.json` の `turbo.pipeline` で `@hierarchidb/plugin-base` や runtime への `build` 依存を宣言し、`dist/` の `clean: false` 前提で再ビルドを最小化する。
  - `config/` は Feature Flag や Turbo パイプライン (pipeline) の実行順、`scripts/env/*.sh` は dev/build で読み込む環境変数を保持。`docs/` と `app/docs/` はアーキテクチャ設計、Worker 初期化、プラグイン実装ガイドの一次情報。

- **TypeScript path & references policy (2026-01-26, NodeNext 対応版)**
  - ルートの `tsconfig.base.json` に、ワークスペース alias（例: `@hierarchidb/foo`）を **必ず `dist/*.d.ts` または公開 exports 指向で** 定義する。`src/` 参照は登録しない。
  - 型チェックは **常に dist が最新であることを前提**に実行する。`pnpm typecheck` は Turbo の build 依存で dist を先に生成する運用とし、個別の `pnpm --filter <pkg> typecheck` でも必要に応じて先に `build` を実行する。
  - 各パッケージの `tsconfig.json` では、原則として追加の `paths` を持たず、`tsconfig.base.json` の alias をそのまま利用する。暫定対処でローカル `paths` を追加した場合は、依存の `.d.ts` 出力が整い次第速やかに撤去する。
  - `tsconfig.build.json` では `paths` を空（もしくは最小限）に保ち、代わりに `references` で依存パッケージ（例: `../common/types/tsconfig.build.json`）を明示する。`tsc -b` で依存先の型出力を先に生成し、NodeNext の解決規約に従ってビルド順を保証する。
  - NodeNext では `dist/*.d.ts` 未生成だと TS7016/TS6305 が発生するため、**build 依存は project references + Turbo の依存順序で保証する**。必要に応じて `pnpm --filter <pkg> build` または `npx tsc -b` で依存チェーンの `.d.ts` を明示的に更新し、理由と撤去予定を TASKS 運用ログに記録すること。
  - Turbo 側は `dependsOn: ['^build:types']` を維持し、`pnpm typecheck:graph` が NodeNext モードでグリーンになることを DoD とする。

## プラグイン機構と UI ↔ Worker API

- **Registry & Loader**
  - 各プラグインは `package.json` の `hierarchidb.plugin` セクション（例: `plugins/shape-plugin/package.json`）に nodeType・Dexie DB・UI/Worker 入口・依存関係を宣言し、`@hierarchidb/plugin-registry` が `PluginDefinition` / `PluginRegistryEntry` へ変換する。`tools:gen-plugin-registry` 完了後、UI/Worker は同一の JSON を参照するためロード順・依存解決が揃う。
  - `app/src/plugin-registry/preconnect.ts` はその定義から `pluginDefinitions`・`pluginUi/Worker/IconLoaders`・`pluginDatabaseLoaders` を導出し、`import.meta.glob('../../../plugins/*-plugin/src/**/index.{ts,tsx}')` で遅延 import 可能なファクトリとして公開する。UI のメニュー構築や Dialog 拡張登録はこのモジュール経由で行う。
  - Worker 起動処理（`app/src/worker-runtime/worker.ts`）は `WorkerInitializationReporter` → `pluginWorkerLoaders` → `@hierarchidb/runtime-worker` の `WorkerModuleLoader` → `wirePluginsFromModules` の順でモジュールを読み込み、deny-list / fallback / legacy defs もここで処理する。結果として `getAllRuntimeExports()` から lifecycle/handler を抽出し、プラグイン定義へ差し戻す。

- **UI レイヤ（`@hierarchidb/plugin-ui-host` / `plugin-ui-sdk`）**
  - `packages/plugin-ui-host/docs/ARCHITECTURE.md` の MultiStep ダイアログが UI のコア。Jotai Atom (`draftAtom`, `dialogStateAtom`, `validationResultsAtom`, `stepCapabilitiesAtom`) と `useWorkerSync` が 100ms デバウンスの Comlink RPC をラップし、`StepCapabilities`（`canNavigateTo`/`canStartBatch` 等）をプラグインごとに合成する。
  - ワーキングコピーは CoreDB の TreeNode `draftData`/`draftMetadata` を正とする。UI では URL Query でステップ位置を保持し、Jotai でリアクティブに管理する。`plugins/README.md` の 3 層アーキ図にある通り、UI ↔ Worker 間は Comlink + MessageChannel の RPC のみを使用し、プレビューや Progress 表示は `WorkerBridge` を経由する。

- **Worker レイヤ（`@hierarchidb/runtime-worker` / `plugin-service-sdk`）**
  - `packages/plugin-service-sdk/src/worker/bridge.ts` の `getWorkerBridge()` は `window.__HDB_WORKER_CLIENT_REF__`（`WorkerProvider` が注入）の Remote を捕捉し、`startBatchSession`/`getBatchSessionStatus`/`pause`/`resume`/`cancel`/`subscribeBatchProgress` を UI に提供する。`plugins/location-plugin/src/common/hooks/useLocationProgress.ts` 等の hook はこの Bridge を介して進捗イベントを購読する。
  - `@hierarchidb/runtime-worker` は IoC コンテナ (`WorkerDiTokens`) で Plugin loader を DI し、`PluginWorkerModuleLoader` が Dexie ストア登録や `register<Plugin>WorkerStores` 呼び出しを担う。`@hierarchidb/ui-worker-client` の `wirePluginsFromModules` が EntityHandler/Lifecycle hook を登録し、Undo/Redo・Import/Export・Draft API を 1 か所で公開する。

## Turbo ベースの開発・ビルド・型チェックフロー

- `turbo.json` は `build`/`test`/`typecheck`/`lint`/`format`/`dev`/`preview`/`e2e`/`wfl` を定義し、`^` 接頭辞で親タスクの build/type 出力を保証する。`typecheck` は `^build` + `^typecheck` に依存し、`wfl` は Worker Flow Lab のレポートを `reports/runtime-worker/*.xml` に出力する設定。
- `pnpm dev` は `dev:pre`（`guard:deps:extra` → optional dep-fence → `dev:ensure-plugin-alias`）の後に `scripts/env/development.sh` / `app/.env.secrets` を読み込み、`pnpm --filter @hierarchidb/app dev` を起動する。`pnpm dev:with-watch`（`scripts/run-dev-with-turbo-watch.mjs`）は `turbo run build --filter @hierarchidb/app^... --watch` と UI dev server を並列実行し、片方の停止時に両方へ SIGINT を送ってクリーンに終了させる。
- `pnpm build` は `build:pre` で favicon 生成・dep-fence・ライセンス・TS config policy・`pnpm as-any:check`・`pnpm lint` を通した後、`build:start` で `scripts/env/production.sh` を読み込み `pnpm build:turbo`（=`turbo run build`）を実行する。`pnpm preview`/`pnpm e2e` も turbo タスクをラップし、`preview`・`e2e` は `build` 依存に設定済み。
- `pnpm typecheck` / `pnpm typecheck:ci` / `pnpm test` は turbo タスクを全パッケージにブロードキャストし、CI では `NODE_OPTIONS="--max-old-space-size=4096"` などメモリ制限を付与する。プラグイン単位の検証は `pnpm --filter @hierarchidb/<plugin> typecheck|test` または `pnpm build:plugins`（代表的なプラグインだけを turbo build）で対応。
- プラグイン各社の `package.json` で宣言している `turbo.pipeline.build.dependsOn`（例: `@hierarchidb/plugin-base#build`）に合わせ、**JS バンドルは tsdown を基本**とする。d.ts は rollup-plugin-dts/tsc を別タスクで生成してよい。依存 `.d.ts` が古い場合は `pnpm --filter <pkg> build` や `npx tsc -b` を TASKS.md のチェックリストに追加し、Turbo キャッシュは `pnpm clean && turbo run clean` で明示的に破棄する。
- プラグインメタデータを変更したら `pnpm tools:gen-plugin-registry` → `pnpm lint && pnpm typecheck` → `pnpm dev`（または `pnpm preview`）の順で検証し、UI メニューと Worker モジュールが同じ `pluginDefinitions` を参照しているか（`app/src/plugin-registry` と `@hierarchidb/plugin-registry` dist）を確認する。

### tsdown ベースのバンドルポリシー

- 2025-11 以降、ライブラリ/プラグインの JS バンドルは原則 `tsdown … --config ../../../tsdown.config.ts` を用いる。`tsup.config.*` や `tsup` CLI の呼び出しが残っていたらレガシー扱いとし、差分に触れたタイミングで撤去する。`pnpm --filter <pkg> build` は **JS + d.ts を含む総合ビルド導線**とし、必要に応じて `build:js` / `build:dts` を組み合わせる。
- **d.ts の生成は別経路を許可**する（rollup-plugin-dts または `tsc --emitDeclarationOnly`）。複数エントリを持つプラグインは **d.ts 出力パスを明示**し、`index2.d.ts` / `index3.d.ts` のような暗黙リネームに依存しない。`tsdown` 側の d.ts を無効化する場合は `package.json` の `tsdown.dts: false` を設定する。
- ルートの `tsdown.config.ts` は `dependencies`/`peerDependencies`/`optionalDependencies` をまとめて `external` に追加し、`clean: false`・`sourcemap: true`・`outExtension` 固定（`.js`/`.d.ts`）を共通設定として注入する。パッケージ固有の override は `package.json` の `tsdown` セクションで行い、`define`/`inject` を指定したい場合は config が自動的に `transform` にマージされる。必要なら `TSDOWN_DEBUG=1 pnpm --filter <pkg> build` で最終設定を出力して確認する。
- 複数エントリーポイントを持つパッケージは tsdown CLI の引数で明示的に列挙し（例: `tsdown src/preconnect.ts src/stageWorker.entry.ts --config …`）、`dist/` を共有する構成に統一する。`dist` を温存したい理由（ウォームスタートや Dexie schema の比較など）があるため、`clean: false` を維持し、クリーンビルドが必要な場合のみ `pnpm clean && turbo run clean` を使用する。
- **d.ts を別経路で生成する場合は** Turbo の `pipeline` に `build:dts` を追加し、`build` が `build:js` と `build:dts` を依存する構成にする。運用ルール（コマンド、依存順、ロールバック）を TASKS.md に記録する。
- `tsdown` でのビルドが失敗した場合は TASKS 運用ログへコマンド・終了コード・ログ概要を貼り付け、必要に応じて tsdown 導入前のコミットへ revert して `tsup` スクリプトを一時復旧する。その際もロールバック手順と再適用計画（再移行 TODO）を Kanban/ログに追記する。

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile` – sync dependencies before editing.
- `pnpm dev` / `pnpm dev:with-watch` – launch the app and worker watchers.
- `pnpm typecheck` – workspace TypeScript validation; append `pnpm --filter <pkg> typecheck` for targeted checks.
- `pnpm test` / `pnpm --filter @hierarchidb/runtime-worker test -- --run undo-folder-operations` – Vitest suites globally or for worker critical paths.
- `pnpm lint` / `pnpm format` / `pnpm biome:check` – enforce linting and formatting.
- `pnpm e2e` – execute Playwright smoke tests; capture failures in `TASKS.md`.

## Coding Style & Naming Conventions
TypeScript is standard. Keep one primary export per file, match CamelCase filenames to exported symbols, and avoid deep `../src` imports. Use `import.meta.env` instead of `process.env`, keep browser code free of Node globals, and run `pnpm format` plus `pnpm lint` or `pnpm biome:check` before review. Runtime feature flags backed by `FEATURE_FLAGS` have been retired—prefer explicit configuration modules or environment variables documented in `TASKS.md` when conditional behavior is unavoidable.
- 再エクスポートは禁止。例外は `src/index.ts` と package.json の export エントリに対応するトップレベルの `index.ts` のみ。

## Testing Guidelines
Run Vitest globally (`pnpm test`) or per package (`pnpm --filter <pkg> test`) and extend Worker Flow Lab suites under `packages/runtime-worker`. Playwright specs live in `e2e/`; name files `*.spec.ts` and clear skip markers quickly. Log each command and outcome in the TASKS運用ログ, add regression coverage for new logic, and document any remaining gaps with timestamps and next steps.

## Commit & Pull Request Guidelines
Use `TASKS.md` as the single source of truth: move cards to Doing, note branches as `<type>/<scope>/<slug>`, and record start/done timestamps. Follow Conventional Commits (`feat(runtime-worker): add undo redo guard`) and keep diffs focused. Before review run `pnpm lint && pnpm format && pnpm typecheck && pnpm test`, plus any package-specific checks you touched. PRs should list acceptance criteria, feature-flag defaults, verification evidence, and rollback steps so reviewers can revert safely.

## Agent Workflow Notes
Work in small, reviewable increments. Document sandbox blockers and attempted alternatives in `TASKS.md`, and never modify code without updating the Kanban and 運用ログ. Prioritise reversibility—capture config edits, migrations, and generated assets so a flag toggle or revert restores prior behaviour quickly.

### Dialog hosting (TreeConsole / Draft)
- Creation flow: `create:<nodeType>` → working copy node作成 → `/t/<treeId>/<parentId>/<wcNodeId>/<nodeType>/create` へ遷移し、plugin registry の UI エントリ経由でダイアログをロードする。
- Host責務は app 側（HeadlessPluginDialog + `useTreeNodeUpdater` で `draftMetadata`/`draftData` を扱う）。Plugin側は UI エントリ公開とステップ/評価ロジックの提供に集中する（詳細: `docs/draft-dialog-hosting.md`）。

### 作業プロセスの自己ルール
- **DoD 提案義務**: ユーザーからタスク指示を受けるたびに、着手前に自分から DoD（受け入れ基準）を箇条書きで提案し、ユーザーの了承を得てから作業を開始する。承認前にタスクを進めない。
- **検証の明示**: 作業完了と主張する際は、成功ログ（コマンド名・終了コード・出力要点）を提示し、未検証の項目があれば理由と今後の案を記載する。
- **検証の自動実行**: コード修正の依頼後に `pnpm install` / `pnpm build` / `pnpm typecheck` の実行が必要な場合は、指示がなくても実行する。エラーが出た場合は原因を修正し、exit 0 になるまで再実行した上で完了報告する。
- **指示再確認**: 重要な指示（初期プロンプト、TASKS.md、個別依頼）は作業前に読み返し、回答直前にも遵守確認を行う。
- **疑義エスカレーション**: 不明点や仮定を伴う判断が必要な場合は、独断で決定せずにユーザーへ必ず確認を取る。
- **フォールバック禁止**: ユーザーから明示的な指示がない限り、互換性維持や保険目的のフォールバック実装を行わない。必要な場合は事前に確認する。
- **型の厳格運用**: `nodeId` など必須値は型で必須化し、`null/undefined` を許容する修正や黙認は行わない。
- **non-null assertion 禁止**: `!` による non-null assertion は使用しない。必要なら型を厳密化するかガードで安全に処理する。
- **型の混在禁止**: 新旧混在の型（互換目的の union/accept 分岐を含む）を禁止する。暫定フォールバック・曖昧な型・互換目的の受け入れ分岐は実装しない。必要なら破壊的変更として明示し、事前に合意を取る。
- **依存タスクの順序制御**: Turbo は同名タスク間でのみ順序保証される。runtime/plugin など別パッケージの `.d.ts` に依存する場合は、明示的に `pipeline.build(:types|:bundle)` を設定し、`prebuild:*` で `pnpm --filter <pkg> build(:types|:bundle)` を先行実行する。`tsdown` は root config で `clean: false` を強制しているため、個別パッケージで `clean` を上書きしない。
- **依存タスクの順序制御**: 他パッケージの `.d.ts` を参照するビルドでは、依存先の `build` / `build:types` / `build:bundle` を Turbo で明示し、必要に応じて `prebuild:*` で `pnpm --filter <pkg> build[:types|:bundle]` を実行してから自パッケージの `tsc`/`tsdown` を呼び出す。`tsup` 系のスクリプトは廃止済みであることを常に意識する。
- **依存タスクの順序制御**: `@hierarchidb/*` の `.d.ts` を使うプラグインは、Turbo の `pipeline` や `prebuild:*` で `pnpm --filter <pkg> build(:types|:bundle)` を先に呼び出し、その後に `tsdown` を起動する。dist を消したい場合は明示的に `pnpm clean` 系のタスクを実行し、`tsdown` へ `clean:true` を渡さない。
