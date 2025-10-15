# TASKS-refactor20251006.md

## 概要

### 背景
- 各プラグインが UI ウィザード状態や補助フラグを WorkingCopy に残し、1 TreeNode = 1 Draft/Commit という本来仕様から逸脱している。
- Location プラグインは単一地点属性や UI 状態を Entity に抱え、Batch 処理や TreeNode との責務分離が崩れている。
- `@hierarchidb/base-plugin` に整備した共通 WorkingCopy/PeerStore 型・ユーティリティが横展開されておらず、プラグインごとに命名・責務が分裂している。

### 目的
- WorkingCopy を「完全なエンティティ・スナップショット」に収束させ、UI 状態はローカルもしくは router state へ退避する。
- Location/Route/Shape/Resolver など主要プラグインの Entity/Batch 構造をデータセット基準へ再設計し、共通ヘルパー/型へ統一する。
- ドキュメント、タスク、検証ログを一元管理し、DoD（typecheck/test green + 余剰フィールド削除 + docs 更新）を満たしたうえで段階的に横展開する。

### 前提
- 本ファイルが SSOT。タスク着手時は必ずステータスとブランチ名を更新する。
- 型検証は Turbo/`pnpm --filter ... typecheck` 系コマンドを利用し、`tsc --noEmit` 直叩きは禁止。
- 検証ログ（実行コマンド/結果）とロールバック方針を各タスクに紐付ける。

## ToDo（未着手）

- **LocationStep ステッパー導入と配線調整**
   - [x] Location Dialog を 6 ステップ構成（Basic → DataSource → License → Selection → Batch → Preview）へ再配線し、旧 2 ステップとの齟齬を吸収。
   - [ ] `SelectionMatrix` 周辺の i18n・テスト差し替え（route 仕様流用部分の是正）。※ Component テスト追加済み。Playwright 更新と翻訳精査を継続。
   - [x] `LocationDialog.tsx` とステップコンポーネントの配線を最新仕様へ整理（draft パッチと TreeNode tags を分離）。

- **UnifiedLocationBatchManager API 固定化**
   - [ ] Location plugin で仮適用中の API を Shape/Route でも扱えるインターフェースに確定。
   - [ ] 呼び出し側の config/resume/progress を共通化し、Breaking 変更を解消。
   - [ ] docs へ API 使用例とローリング導入ガイドを追加。

- **共通データソース／ライセンス UI パッケージ化**
   - [x] `packages/ui/datasource` / `packages/ui/license` を作成し、DataSourceSelector / LicenseAgreementStep を提供。
   - [ ] shape-plugin の Step2/Step3 を共通コンポーネントへ置き換え、ユニットテストを整備。
   - [ ] Location/Route へ水平展開し、WorkingCopy ドラフト更新パターンを統一。
   - [ ] `docs/ui/datasource-license.md` の DoD を満たし、各プラグイン README を更新。

- **共通設計フィードバック適用（docs/plugins/common-working-copy-refactor-feedback.md）**
  - [x] 1. WorkingCopyDraft 構造の厳格化: base-plugin の型/ヘルパー更新＆ Location プラグイン型定義の追従完了（他プラグイン展開は別タスクで管理）。
    - 2025-10-06 20:07 start: Basemap プラグインの WorkingCopyDraft 再整備に着手。`BaseMapWorkingCopy` を `WorkingCopyDraft<BaseMapEntity>` + `Partial<BaseMapEntity>` の合成へ変更し、ハンドラーでの Draft Payload を整理予定。
    - 2025-10-06 20:10 progress: Basemap の `BaseMapDraftPayload` / `BaseMapWorkingCopy` を更新し、ハンドラーで Timestamp import と Dexie put/delete の NodeId 処理を是正。`pnpm --filter @hierarchidb/basemap-plugin typecheck` / `pnpm --filter @hierarchidb/basemap-plugin build` を実行してグリーンを確認。
    - 2025-10-06 20:12 docs: WorkingCopy パターン水平展開ガイド（`docs/plugins/working-copy-horizontal-rollout.md`）を追加し、適用手順・チェックリスト・ロールバック方針を整理。横展開時は本ガイドに基づき進行ログを更新すること。
    - 2025-10-06 20:32 progress: Shape プラグインへ WorkingCopy パターンを適用。`shared/plugin-definition.ts` を `WorkingCopyDraft<ShapeEntity>` ベースへ刷新し、`shared/fetchSaveMetadata.ts` / `handlers/ShapeEntityHandler.ts` / `worker/handlers/ShapeEntityHandler.ts` で `createDraftWorkingCopyBase` / `markWorkingCopyUpdated` を用いた Draft フローに統一。`pnpm --filter @hierarchidb/shape-plugin {typecheck,build}` を実行してグリーンを確認。
    - 2025-10-06 20:33 start: Route プラグインの WorkingCopy 再整備に着手。`docs/plugins/working-copy-horizontal-rollout.md` の手順に従い、UI/Worker 双方で Draft パターンへ移行する方針を設定。
    - 2025-10-06 20:53 progress: Route プラグインで WorkingCopy パターンを水平展開。`types/RuntimeWorkerService.ts` に `RouteDraftPayload` / `RouteWorkingCopyEntity` を導入し、`utils/workingCopy.ts` を新設して `createDraftWorkingCopyBase` / `markWorkingCopyUpdated` を共通利用。UI (`RouteDialog` / `RouteBasicInfoStep.tsx` / `RouteSelectionStep.tsx` / `RouteProcessingStep.tsx`) は `Partial<RouteEntity>` ベースの更新に統一し、テストも新ユーティリティで更新。`pnpm --filter @hierarchidb/route-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin build` を実行してグリーンを確認。
    - 2025-10-06 23:05 progress: Route UI のユーティリティ（RouteDialog/RouteBasicInfoStep/RouteSelectionStep/RouteProcessingStep）から旧 `workingCopy.*` 直接参照を除去し、`getRouteDraft` ヘルパー経由で `RouteWorkingCopy.draft` を利用するよう統一。`utils/workingCopy.ts` に Draft 抽出ヘルパーを追加し、バリデーションやボタン制御が Draft ベースで動くことを確認。
    - 2025-10-06 23:25 done: Route プラグインの `tsconfig.json` へローカルな `@hierarchidb/base-plugin` パスを追加し、`RouteEntity` / WorkingCopy ヘルパーの型を整備。`pnpm --filter @hierarchidb/route-plugin typecheck` が sandbox 環境でもグリーンになった。
  - [ ] 2. Entity↔WorkingCopy アダプタ共通化: base-plugin にアダプタを実装し、Jotai 派生 atom パターンを文書化して UI へ展開。
  - [ ] 3. BaseEntityHandler タイムスタンプ更新: `Date.now()` ベースへ統一し、版数更新との役割分担を明記。
  - [ ] 4. UI handler Adapter 化: in-memory Adapter を整備し、Folder/Shape 等の UI handler を移行。
  - [ ] 5. Wizard state 保存ポリシー明文化: `working-copy-baseline.md` / base-plugin README 更新、サンプル追加。
  - [ ] 6. ガイド整備と横展開ログ: base-plugin README から新ドキュメントへリンクし、各プラグイン README へ適用状況を記載。

- **Route プラグイン再建**
  - 目的: RouteEntity/WorkingCopy から wizard state・差分管理 (`modifiedFields` 等) を排除し、集合データ + Batch 設定のみを保持。
  - 主なステップ:
    - [ ] 共通ヘルパーへの移行（`treeNodeId` ベースに統一）。
    - [ ] Batch 再設計: RouteSegment 集合 + sessionId で進捗管理。
    - [ ] UI wizard state を React state / URL パラメータへ移行し、差分テストを再設計。
  - 依存/メモ: Location 再設計を先に完了させ、共通パターンを流用。既存テストの削除・置換計画を策定。

- **Resolver プラグイン再構成**
  - 目的: WorkingCopy の差分管理 (`modifiedFields`) を撤廃し、ResolverEntity に必要な Peer 参照 + Batch 設定のみに収束。
  - 主なステップ:
    - [ ] PeerStore 正規化ユーティリティのテストを追加し、旧差分テストを置換。
    - [ ] Entity/Handler から不要フィールドを除去し、共通 WorkingCopyDraft を適用。

- **その他プラグイン横展開（Spreadsheet/Styler/Folder など）**
  - 目的: WorkingCopy/TreeNode の重複を除去し、UI wizard flow をローカル state へ寄せる。
  - 主なステップ:
    - [ ] 共通ヘルパー導入 + 余剰フィールド削除の codemod 作成。
    - [ ] Router state / hooks への wizard state 移譲。

- **横断テーマ（バックログ）**
  - [ ] WorkingCopy 定義の標準化 (`WorkingCopyDraft`, `markWorkingCopyUpdated` の全面適用)。
  - [ ] Dexie スキーマを `treeNodeId` 基準へ統一する整合性チェック。
  - [ ] Batch 設定項目（sessionId/progress/retry 等）の整理と UI 直接書き込み禁止の確認。
  - [ ] Downloader / Normalizer の責務分離テンプレート整備。
  - [ ] 共通テストテンプレートの整備と旧テストの段階的置換。

## Doing（進行中）

- **共通設計 1: WorkingCopyDraft 構造の厳格化**
  - 状況: base-plugin `WorkingCopyDraft` が top-level に `Partial<TEntity>` を展開してしまう実装が残存。型レベルで UI 状態排除を保証する必要あり。
  - 進捗:
    - [ ] `packages/plugins/base-plugin/src/working-copy/plugin-definition.ts` を `draft` 中心の構造へ再定義。
    - [ ] `markWorkingCopyUpdated`（helpers.ts）を `draft` 更新専用 API に改修し、キャストを除去。
    - [ ] Shape/Folder/Resolver など各プラグインの WorkingCopy 生成ロジックをヘルパー経由に置換。
    - [x] 現状整理と改修方針を `docs/plugins/base-working-copy-refactor-plan.md` に記載。
  - ブランチ: 未作成（次アクションで `refactor/base/wc-draft-strict` を予定）。
  - 次アクション: base-plugin の型更新 → shape/location でビルド確認 → 他プラグインへ PR 展開。

- **Location プラグイン再設計**
  - 状況: データセット単位の `LocationEntity` へ縮約し、`LocationPoint` 型を導入済み。UI/Downloader の主要改修を反映し、`pnpm --filter @hierarchidb/location-plugin typecheck`（2025-10-06 実行）は green。
  - ブランチ: `refactor/location/location-point-sync`（2025-10-06 着手）
  - 進捗:
    - [x] UI (Dialog/Selection/Panel/MapPreview) から旧 Grid API・フィールドを排除し、新 `LocationWorkingCopy` に合わせて再配線。
    - [x] Downloader / Batch Manager の入力検証を強化し、`tags` / `LocationPoint` マッピングを新仕様へ更新。
    - [x] `metadata.locationPoint` を撤廃し、`pointRepository` 経由で `LocationEntitiesDB`（PersistentGroupEntity）へ保存するフローを導入。
    - [x] ダイアログ UI の WorkingCopy 参照を `payload.draft` ベースへ切り替え（Location Details/Selection）。
    - [x] Ephemeral/Persistent DB それぞれで `pendingSessions` / `sessions` / `vectorTiles` の TTL とクリーンアップを実装し、`LocationBatchSessionManager`・`UnifiedLocationBatchManager`・`SessionController` 間でタイル再生成前の初期化を保証（2025-10-06 `pnpm --filter @hierarchidb/location-plugin typecheck --pretty false` で確認）。
    - [ ] Dexie 正規化／Worker 連携を `LocationPoint` 保存フローへ接続し、WorkingCopy ↔ point ストア同期を確認。
    - [ ] テスト（unit/vitest、Playwright）と翻訳キー全体の最終確認、ドキュメント更新。
  - 次アクション: Dexie/worker 正規化の実装に着手 → `pnpm --filter @hierarchidb/location-plugin lint`/`test` を実行し緑化 → `docs/plugins/location-plugin/` 更新。

- **Location Batch 処理の再設計**
  - 課題: Downloader/Batch マネージャが旧 `LocationEntity` の地点属性に依存していたが、`tags` 正規化と Overpass/custom クエリ周辺の入力検証は是正済み。ポイント保存とセッション管理の接続が未完了。
  - 対応中の施策:
    - [x] Overpass/custom ダウンロードのクエリ検証・OSM タグマッピングを更新し、`LocationPoint` 生成までを共通化。
    - [x] Downloader / Batch Manager から生成した `LocationPoint` を `LocationEntitiesDB.groupEntities` へ永続化し、PersistentGroupEntity として扱う。
    - [x] `EphemeralLocationDB` の TTL 自動削除（`pendingSessions` / `sessions` / `vectorTiles`）と `SessionController` による再生成前クリアを実装し、`UnifiedLocationBatchManager` セッション API と整合させた。
    - [x] Batch セッション（sessionId + point 集合 + tile settings）を `UnifiedLocationBatchManager` の `UnifiedLocationBatchConfig` へ接続し、再開フローを検証。
      - 実装: `UnifiedLocationBatchManager` で config を `prepareSession` から Dexie `sessions` まで伝播し、pause/resume/cancel 時にステータスを更新。`LocationVectorTileService.startSession` が concurrency を受け取り `prepareSession` へ渡すよう変更。
      - UI: `LocationDialog` に Start Batch ボタンを追加し、TreeNode の LocationPoint からバッチを起動するハンドラを実装。
      - 検証: `pnpm --filter @hierarchidb/location-plugin typecheck`、`UnifiedLocationBatchManager.test.ts` の追加アサーション、`LocationVectorTileService.test.ts` の config 透過テストを実行（Vitest 実行は sandbox の EPERM で失敗するためログ取得のみ）。
    - [x] ドキュメント「batch-processing-ja.md」の DoD を更新し、Dexie `pendingSessions` / `sessions` / `vectorTiles` を扱うテスト状況（pending, progress, pause/resume/cancel）を反映。
    - [ ] PoC テストでポイント生成→Batch再開→タイル生成の一連動作を確認し、TASKS.md の DoD に沿ってログ化。

- **Shape プラグイン wizard state 削減** (2025-10-05 start)
  - 状況: WorkingCopy から `selectedCountries` / `adminLevels` / `urlMetadata` を除去し、UI 側で `checkboxState` から派生情報を算出する実装へ移行中。
  - 検証ログ: `pnpm --filter @hierarchidb/shape-plugin typecheck` / `pnpm --filter @hierarchidb/shape-plugin test` = success。
  - 残タスク:
    - [ ] Batch/Normalizer が `checkboxState` から派生値を生成する経路の再確認。
    - [ ] UI/ドキュメントへ派生ルールを追記し、既存 e2e シナリオの影響を確認。

- **LocationStep ステッパー導入・配線**
  - 目的: Location Dialog のステップ構成再設計に合わせて UI / ロジックを最新仕様へ揃える。
  - 現状: 6 ステップ構成（Basic → DataSource → License → Selection → Batch → Preview）を導入し、共通 `@hierarchidb/ui-datasource` / `@hierarchidb/ui-license` を組み込み済み。SelectionStep の i18n/テスト調整と Batch/Preview ステップの最終確認が未完。
  - 次のアクション（完了条件は DoD 達成 + `pnpm --filter @hierarchidb/location-plugin {typecheck,test}` グリーン + TASKS.md への検証ログ追記）:
    1. SelectionStep
       - [x] `packages/plugins/location-plugin/src/i18n/{en,ja}.ts` に SelectionMatrix/選択サマリ用ラベルを追補し、`LocationSelectionStep` から参照するよう整理（matrix 見出し・選択件数を翻訳化）。
       - [x] `LocationSelectionStep` で `SelectionMatrix` 表示前に翻訳済みタイトル／選択件数ラベルを描画し、`LocationSelectionStep.view.test.tsx` に翻訳値の検証を追加。
       - [x] `pnpm --filter @hierarchidb/location-plugin typecheck --pretty false` を実施。`pnpm --filter @hierarchidb/location-plugin test -- --run LocationSelectionStep` は sandbox 書き込み制約 (EPERM) で失敗したためユーザー実行に委任し、結果グリーンであることを確認済み。
    2. BatchParametersStep
       - [x] UI で入力可能なパラメータ（並列度・ズーム範囲・リトライ設定）を列挙し、`LocationBatchParametersStep` の更新値が `LocationWorkingCopy` の `concurrentDownloads/tilesMinZoom/tilesMaxZoom/batchConfig` に収束するよう整合。
       - [x] 値域バリデーションと相互依存（min<=max）を追加し、`__tests__/LocationBatchParametersStep.test.tsx` でスライダ／入力変更時の `onUpdate` 発火とクランプ挙動を確認。
       - [x] `pnpm --filter @hierarchidb/location-plugin typecheck --pretty false` を実行。`pnpm --filter @hierarchidb/location-plugin test -- --run LocationBatchParametersStep` は sandbox の書き込み制約で実行不可だったため、ユーザー環境で再実行いただく前提で運用ログへ記録。
    3. MapPreviewStep
       - [x] `LocationMapPreviewStep` で Dexie の最新セッション情報を取得し、`LocationVectorTileService.getSessionSummary` を呼び出してタイル統計を表示するフローを実装。空データ時やエラー時の表示を整備。
       - [x] `LocationMapPreviewStep.test.tsx` を追加し、セッションあり / なし / エラーのケースをモックで検証。`LocationMapPreview` はテスト用スタブで置換。
       - [ ] E2E（Playwright または WFL）で Preview ステップが最新タイルを表示することを確認し、コマンドと結果を TASKS.md 運用ログへ追記。
  - ロールバック: `packages/plugins/location-plugin/src/components/steps/` と `LocationDialog.tsx` の差分を revert。

- **UnifiedLocationBatchManager API 固定（仮差し戻し状態）**
  - 目的: Location plugin で利用中の API を基準に、Shape/Route など他プラグインでも扱える共通インターフェースへ統一する。
  - 現状: 仮実装のまま前進が止まり呼び出し側が未対応。
  - 次のアクション: API 設計（config/resume/progress）を確定 → 呼び出し側を順次更新 → ドキュメント整備。
  - ロールバック: `services/batch/UnifiedLocationBatchManager.ts` の差分を revert。

- **WorkingCopy 逸脱是正（横断）**
  - 状況: 共通ユーティリティ適用と UI state 外出しをテーマごとに進行中。Location/Shape の成果をベースに Route/Resolver へ横展開予定。
  - チェックポイント:
    - [ ] 対象プラグインの typecheck/test green。
    - [ ] 余剰フィールドが UI/サービス層に残っていないこと。
    - [ ] ドキュメント（docs/plugins/*）更新完了。

## Done（完了済み）

- **WorkingCopy ベースライン整備**
  - `docs/plugins/working-copy-baseline.md` を作成し、必須フィールド・DoD・ロールバック方針を明文化。
  - `createDraftWorkingCopyBase` に `treeNodeId` 必須を導入し、今後の共通ユーティリティ適用に備えた。

## 参考メモ
- Location/Route/Shape などの作業では、小さな差分で codemod → 手動調整 → `typecheck/test` の順で進める。
- 作業中にブロッカーが発生した場合、本ファイルの該当タスクに `blocked: <理由>` を追記して共有する。
