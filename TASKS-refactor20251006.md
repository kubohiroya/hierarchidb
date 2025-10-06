# TASKS-refactor20251006.md

## 概要

### 背景
- 各プラグインが UI ウィザード状態や補助フラグを WorkingCopy に残し、1 TreeNode = 1 Draft/Commit という本来仕様から逸脱している。
- Location プラグインは単一地点属性や UI 状態を Entity に抱え、Batch 処理や TreeNode との責務分離が崩れている。
- `@hierarchidb/plugins-base-plugin` に整備した共通 WorkingCopy/PeerStore 型・ユーティリティが横展開されておらず、プラグインごとに命名・責務が分裂している。

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
   - [ ] Location Dialog の 4 ステップ構成（Details/Selection/Preview/Confirm）に合わせ、既存 2 ステップ構成との齟齬を吸収。
   - [ ] `SelectionMatrix` 周辺の i18n・テスト差し替え（route 仕様流用部分の是正）。
   - [ ] `LocationDialog.tsx` とステップコンポーネントの配線を最新仕様へ整理。

- **UnifiedLocationBatchManager API 固定化**
   - [ ] Location plugin で仮適用中の API を Shape/Route でも扱えるインターフェースに確定。
   - [ ] 呼び出し側の config/resume/progress を共通化し、Breaking 変更を解消。
   - [ ] docs へ API 使用例とローリング導入ガイドを追加。

- **共通設計フィードバック適用（docs/plugins/common-working-copy-refactor-feedback.md）**
  - [ ] 1. WorkingCopyDraft 構造の厳格化: base-plugin の型/ヘルパー更新＆各プラグイン型定義の追従。
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
    - [ ] `packages/plugins/base-plugin/src/working-copy/types.ts` を `draft` 中心の構造へ再定義。
    - [ ] `markWorkingCopyUpdated`（helpers.ts）を `draft` 更新専用 API に改修し、キャストを除去。
    - [ ] Shape/Folder/Resolver など各プラグインの WorkingCopy 生成ロジックをヘルパー経由に置換。
    - [x] 現状整理と改修方針を `docs/plugins/base-working-copy-refactor-plan.md` に記載。
  - ブランチ: 未作成（次アクションで `refactor/base/wc-draft-strict` を予定）。
  - 次アクション: base-plugin の型更新 → shape/location でビルド確認 → 他プラグインへ PR 展開。

- **Location プラグイン再設計**
  - 状況: データセット単位の `LocationEntity` へ縮約し、`LocationPoint` 型を導入済み。UI/Downloader の主要改修を反映し、`pnpm --filter @hierarchidb/plugins-location-plugin typecheck`（2025-10-06 実行）は green。
  - 進捗:
    - [x] UI (Dialog/Selection/Panel/MapPreview) から旧 Grid API・フィールドを排除し、新 `LocationWorkingCopy` に合わせて再配線。
    - [x] Downloader / Batch Manager の入力検証を強化し、`tags` / `LocationPoint` マッピングを新仕様へ更新。
    - [x] `metadata.locationPoint` を撤廃し、`pointRepository` 経由で `LocationEntitiesDB`（PersistentGroupEntity）へ保存するフローを導入。
    - [x] ダイアログ UI の WorkingCopy 参照を `payload.draft` ベースへ切り替え（Location Details/Selection）。
    - [ ] Dexie 正規化／Worker 連携を `LocationPoint` 保存フローへ接続し、WorkingCopy ↔ point ストア同期を確認。
    - [ ] テスト（unit/vitest、Playwright）と翻訳キー全体の最終確認、ドキュメント更新。
  - 次アクション: Dexie/worker 正規化の実装に着手 → `pnpm --filter @hierarchidb/plugins-location-plugin lint`/`test` を実行し緑化 → `docs/plugins/location-plugin/` 更新。

- **Location Batch 処理の再設計**
  - 課題: Downloader/Batch マネージャが旧 `LocationEntity` の地点属性に依存していたが、`tags` 正規化と Overpass/custom クエリ周辺の入力検証は是正済み。ポイント保存とセッション管理の接続が未完了。
  - 対応中の施策:
    - [x] Overpass/custom ダウンロードのクエリ検証・OSM タグマッピングを更新し、`LocationPoint` 生成までを共通化。
    - [x] Downloader / Batch Manager から生成した `LocationPoint` を `LocationEntitiesDB.groupEntities` へ永続化し、PersistentGroupEntity として扱う。
    - [ ] Batch セッション（sessionId + point 集合 + tile settings）を `UnifiedLocationBatchManager` の新 `UnifiedLocationBatchConfig` へ接続し、再開フローを E2E 検証。
    - [ ] PoC テストでポイント生成→Batch再開→タイル生成の一連動作を確認し、TASKS.md の DoD に沿ってログ化。

- **Shape プラグイン wizard state 削減** (2025-10-05 start)
  - 状況: WorkingCopy から `selectedCountries` / `adminLevels` / `urlMetadata` を除去し、UI 側で `checkboxState` から派生情報を算出する実装へ移行中。
  - 検証ログ: `pnpm --filter @hierarchidb/plugins-shape-plugin typecheck` / `pnpm --filter @hierarchidb/plugins-shape-plugin test` = success。
  - 残タスク:
    - [ ] Batch/Normalizer が `checkboxState` から派生値を生成する経路の再確認。
    - [ ] UI/ドキュメントへ派生ルールを追記し、既存 e2e シナリオの影響を確認。

- **LocationStep ステッパー導入・配線**
  - 目的: Location Dialog のステップ構成再設計に合わせて UI / ロジックを最新仕様へ揃える。
  - 現状: SelectionStep / PreviewStep がドラフト仕様（route 流用）のまま差し替え途中。
  - 次のアクション: i18n / テスト差し替え、`SelectionMatrix` の実装更新、`LocationDialog.tsx` の配線整理。
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
