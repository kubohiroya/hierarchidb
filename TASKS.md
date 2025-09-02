# タスク管理（ローカル運用）

本リポジトリでは、vibe-kanban の利用を一時停止し、当面はこの `TASKS.md` を単一の情報源（Single Source of Truth）としてタスク管理を行います。

- 運用原則
  - 小粒なPR単位でタスク化（機能フラグは既定OFF、非破壊）
  - 依存関係は明示し、直列/並列を管理
  - 受け入れ基準とロールバック手順を必ず記載
- 進行の更新方法
  - 着手時: ブランチ作成 → 本ファイルの対象タスクを「Doing」へ移動
  - PR作成時: ブランチ名/PRリンクを追記
  - マージ時: 「Done」に移動し、要点・影響範囲を1行で追記

## Git ブランチ戦略

- 基本: GitHub Flow（短命ブランチ→PR→`main`）。通常は Squash & Merge。
- エピック規模（任意）: `epic/wc-trash-unification` を切り、段階PRをそこへ積み上げ、最後に `main` へ統合。
- 命名: `<type>/<scope>/<slug>` 例）
  - `feat/worker/command-registry-skeleton`
  - `feat/worker/envelope-v1`
  - `feat/worker/cp-routing-create-update`
  - `feat/worker/cp-routing-move-remove`
  - `refactor/worker/error-model-unify`
  - `feat/worker/wc-util-baseline`
  - `refactor/worker/wc-impl-align`
  - `feat/worker/policy-c`
  - `feat/worker/trash-holder`
  - `fix/worker/deterministic-sort`
  - `feat/ui/wc-resume-menu`
  - `chore/docs/cleanup-metrics`

## Kanban（このファイルで運用）

### Doing（進行中）

1) CommandRegistry 雛形導入（P1）
- ブランチ: `feat/worker/command-registry-skeleton`
- 依存: なし
- 受け入れ基準:
  - 型定義（CommandMap/Handler/Context）と `createEnvelope<K>()` の導入
  - `pnpm typecheck` で網羅性/不整合検出が機能
  - 実行時挙動は非回帰（現行スイッチと等価）
 - チェックリスト:
  - [x] `services/command/registry.types.ts` 作成
  - [x] `services/command/envelope.util.ts` 作成
  - [x] 未登録コマンドは `INVALID_OPERATION` に集約
  - [x] 型テスト（`expectTypeOf`）を追加

2) WCユーティリティ基盤（holderエンコード）導入（P1）
- ブランチ: `feat/worker/wc-util-baseline`
- 依存: なし
- 受け入れ基準:
  - encode/decode の往復同値、TAB混入防止の防衛が機能
- チェックリスト:
  - [x] `HOLDER_NAME_TAB` 定数と入力サニタイズ
  - [x] decode 厳格検査（空/極長/TAB含む）
  - [x] 異常系テスト＋簡易ベンチ

3) CP 段階ルーティング（create/update 実施）（P1）
- ブランチ: `feat/worker/cp-routing-create-update`
- 依存: Envelope v1（最小でもドラフト合意）
- 受け入れ基準:
  - 既定OFFのフラグで導入（`WORKER_USE_CMDPROC_CREATE_UPDATE`）。OFF時は完全非回帰
  - ON時: TreeMutationService.create/update が CommandProcessor 経由で CoreDB を更新し、戻り値は従来同等
  - runtime-worker スコープで `pnpm typecheck && pnpm test` がグリーン
- チェックリスト:
  - [x] `src/config/feature-flags.ts` を新設し、フラグ読取を集約
  - [x] TreeMutationService にガード分岐を追加（create/update）
  - [x] CommandProcessor の fallback に create/update の実処理（CoreDB）を実装
  - [x] start-env.sh への注入例追記（別PR可）

### ToDo（優先度順）

### Next Up（Doing完了後に着手）

1) CP 段階ルーティング（move/remove）（P1）
- ブランチ: `feat/worker/cp-routing-move-remove`
- 依存: cp-routing-create-update（Doing）
- 受け入れ基準: ToDoの定義どおり（既定OFF `WORKER_USE_CMDPROC_MOVE_REMOVE`、ON時に非回帰）
- チェックリスト:
  - [x] ガード分岐の実装と最小テスト
  - [x] CommandProcessor 実処理（moveNodes/remove）
  - [x] runtime-worker の `pnpm typecheck && pnpm test` グリーン

2) WC 実装アライン（commit V2戻り統一）（P1）
- ブランチ: `refactor/worker/wc-impl-align`
- 依存: wc-util-baseline（Doing）
- 受け入れ基準: ToDoの定義どおり（`ok | COMMIT_CONFLICT | NAME_CONFLICT` へ統一）
- チェックリスト:
  - [x] commit API の戻り型/分岐統一
  - [x] UI 連携の影響点メモ化（後続PRでUI反映）
  - [x] 型通し（runtime-worker スコープ）

3) Undo/Redo 仕上げ（restore含む）（P1）
- ブランチ: `feat/worker/undo-redo-finalize`
- 依存: Envelope v1、cp-routing-move-remove
- 受け入れ基準: restore の逆操作/再適用まで単体・結合テストで担保
- チェックリスト:
  - [x] restore（recoverFromTrash）の逆操作実装
  - [x] 競合時の整合（NAME/COMMIT_CONFLICT）
  - [x] e2e への布石（シナリオ草案）

4) E2E: CPルーティング + WCフロー 包括テスト（P1）
- ブランチ: `feat/e2e/cp-routing-wc`
- 依存: 1)〜3)
- 受け入れ基準: フラグ OFF/ON 両モードで create/update/move/remove の回帰を検証しグリーン
- チェックリスト:
  - [x] start-env.sh のフラグ注入例を整備
  - [ ] OFF→ON 切替シナリオの安定化
  - [ ] レポート保存（e2e-results/）

5) エラーモデル統一（バックエンド）（P1）
- ブランチ: `refactor/worker/error-model-unify`
- 依存: Envelope v1
- 受け入れ基準: CommandResult の統一と例外系の収斂（UIは後続で反映）
- チェックリスト:
  - [x] 型/返却値の統一化
  - [x] 影響範囲の型通し
  - [x] ドキュメント更新（エラー一覧）

6) 観測・計測（軽量）（P2）
- ブランチ: `feat/worker/metrics-command-latency`
- 依存: cp-routing-*
- 受け入れ基準:
  - フラグON時のみコマンド別の回数/失敗/合計レイテンシを記録
  - 開発/テスト用途で `snapshot()` 取得可能（外部出力は後続）
- チェックリスト:
  - [x] 軽量メトリクス実装（services/utils/metrics.ts）
  - [x] ヘッドレステスト（metrics.headless.test.ts）
  - [x] Docs 追加（docs/metrics.md）

P1:
- Envelope v1 完整備（全コマンドの kind/payload/result 型）
  - ブランチ: `feat/worker/envelope-v1`
  - 依存: CommandRegistry 雛形
  - チェックリスト:
    - [x] CommandMap へ WorkingCopy/Trash/Copy/Export を追加（型のみ）
    - [x] コマンド名の用語統一（remove vs moveToTrash 等）を文書追加（`packages/runtime-worker/worker/docs/commands-terminology.md`）
    - [x] 影響範囲の型通し（runtime-worker スコープで `pnpm typecheck` グリーン）
- CP 段階ルーティング（create/update 実施）
  - （Doing へ移動）
- TreeMutation: move/remove を CP 経由へ（Phase 2）
  - ブランチ: `feat/worker/cp-routing-move-remove`
  - 依存: CP ルーティング（create/update）
  - 受け入れ基準:
    - 既定OFFのフラグで導入（`WORKER_USE_CMDPROC_MOVE_REMOVE`）。OFF時は完全非回帰
    - ON時: TreeMutationService.move/remove が CP 経由となり、戻り値は従来同等
    - runtime-worker スコープで `pnpm typecheck && pnpm test` がグリーン
  - チェックリスト:
    - [x] フラグ `WORKER_USE_CMDPROC_MOVE_REMOVE` を追加
    - [x] TreeMutationService に move/remove のガード分岐を追加
    - [x] CommandProcessor に 'moveNodes' / 'remove' の実処理追加
    - [x] ルーティングの最小テスト追加（cp-routing-create-update.test.ts 内）
- Undo/Redo 拡充（update/move/remove/restore）
  - ブランチ: `feat/worker/undo-redo`
  - 依存: Phase 2, Envelope v1
  - 実施（第一段）:
    - [x] updateNode の Undo/Redo を拡張（旧状態の保存と逆操作/再適用）
    - [x] move/remove の逆操作と再適用を実装（最小範囲・子孫の復元は非対象）
    - [x] restore（recoverFromTrash）の逆操作・再適用を実装（最小範囲）
- エラーモデル統一（CommandResult 整流）
  - ブランチ: `refactor/worker/error-model-unify`
  - 依存: Envelope v1
  - 実施: runtime-worker の `CommandResult/ErrorCode` を Core に揃える（`services/command-types.ts` にて型をCoreへ委譲、互換の `WorkerErrorCode` を維持）
- Trash 統合: holder 方式へ移行
  - ブランチ: `feat/worker/trash-holder`
  - 依存: wc-impl-align, policy-c（順次）
- ポリシーC（移動/削除ブロック）
  - ブランチ: `feat/worker/policy-c`
  - 依存: wc-impl-align
  - 受け入れ基準:
    - 既定OFFのフラグ（`WORKER_POLICY_C`）で導入、ON時のみ有効
    - WCがサブツリーに存在するノードの move/remove を INVALID_OPERATION でブロック
    - runtime-worker スコープの `pnpm typecheck && pnpm test` がグリーン（sandboxのEPERMは除外）
  - チェックリスト:
    - [x] `utils/policy-c.ts` に検出ロジック（BFS + holder走査 + decode）
    - [x] `CommandProcessor` の move/remove 入口でガード（フラグON時）
    - [x] 最小ユニットテスト追加（`policy-c.test.ts`）
- WC 実装アライン（仕様適合）
  - ブランチ: `refactor/worker/wc-impl-align`
  - 依存: wc-util-baseline
  - 内訳（サブタスク）
    - [x] holder.name を `${targetParentId}\t${targetNodeId}` に統一（ドラフトは先行採番）
    - [x] `getWorkingCopy(originalNodeId)` を holder 走査＋decode 方式へ切替（`workingCopyOf` 廃止）
    - [x] create の get-or-create 化（ユニーク制約＋再試行、`returnedExisting` を返却）
    - [x] commit 既存APIの V2 寄せ（CPに実装、戻りはCoreのCommandResultへ安全にマップ。V2詳細は内部で処理）
  - 受け入れ基準（追加）
    - create は冪等（同一対象で重複WCを作らない）。ConstraintError 競合は再読込で収束
    - commit は V2 仕様の戻りに統一し、UI で自動リネーム/競合が判別可能

P2:
- 決定的ソート（createdAt→name→id）
  - ブランチ: `fix/worker/deterministic-sort`
  - 依存: なし
- UI導線: 配下WC再開メニュー
  - ブランチ: `feat/ui/wc-resume-menu`
  - 依存: policy-c, wc-impl-align（データ取得面）
- 仕上げ（GC/メトリクス/Docs）
  - ブランチ: `chore/docs/cleanup-metrics`
  - 依存: EPIC完了フェーズ

### 次期ToDo（前提: 現在のDoing/P1完了後）

1) E2E: CPルーティングとWCフローの包括テスト（P1）
- ブランチ: `feat/e2e/cp-routing-wc`
- 依存: cp-routing-create-update, cp-routing-move-remove, wc-impl-align
- 受け入れ基準:
  - Playwright で create/update/move/remove をフラグ OFF/ON 両方で検証
  - start-env.sh からフラグ注入シナリオを整備（本番影響なし）
  - CI で `pnpm e2e` グリーン（レポート保存）
- チェックリスト:
  - [ ] e2e シナリオ（OFF→ON）とリグレッションケース（ヘッドレス統合テストは追加済み）
  - [ ] 既存 e2e に干渉しない isolate データセット
  - [ ] CI レポートの保存・参照手順追記

2) Undo/Redo 仕上げ（restore 含む）とe2e（P1）
- ブランチ: `feat/worker/undo-redo-finalize`
- 依存: undo-redo, cp-routing-move-remove
- 受け入れ基準:
  - restore（recoverFromTrash）の逆操作と再適用を実装し、単体/結合/e2e で検証
  - 競合時の戻り（`ok | COMMIT_CONFLICT | NAME_CONFLICT`）に伴うUndo/Redoの整合
- チェックリスト:
  - [x] 単体テスト（境界/大量/親子連鎖の最小ケース）
  - [ ] e2e: 連続操作の取り消し/やり直し
  - [x] ドキュメント更新（運用と制約）

3) エラーモデル統一のUI反映（通知/トースト）（P1）
- ブランチ: `refactor/app/error-model-unify-ui`
- 依存: error-model-unify
- 受け入れ基準:
  - Unified CommandResult に応じて UI 通知・自動リネーム指示が機能
  - 既存通知との二重表示や取りこぼし無し（ユニット＋レンダリングテスト）
- チェックリスト:
  - [ ] UI エラーマッピングテーブル作成
  - [ ] `@testing-library/react` レンダリングテスト追加
  - [ ] ドキュメント（ユーザガイド）更新

4) Trash holder 方式への移行スクリプト（P1）
- ブランチ: `feat/backend/trash-holder-migrate`
- 依存: trash-holder, wc-impl-align
- 受け入れ基準:
  - 既存Trash→holder方式への移行ユーティリティ（dry-run/実行/ロールバック）
  - メトリクス出力（移行件数/失敗件数/所要時間）とエラーレポート
- チェックリスト:
  - [x] `--dry-run` と `--limit` を備えたスクリプト骨子（`src/tools/trash-migrate.ts`）
  - [ ] `--commit` 実装とロールバック手順（small/big データ）
  - [ ] 運用Runbook追記

5) 観測性: Command 実行レイテンシ/件数メトリクス（P2）
- ブランチ: `feat/worker/metrics-command-latency`
- 依存: cp-routing-* 完了
- 受け入れ基準:
  - `WORKER_METRICS_ENABLED` 既定OFFのもと、コマンド別 p50/p95/エラー率を収集
  - ログ/エクスポート（開発用）と簡易可視化（console/CSV）
- チェックリスト:
  - [ ] 軽量メトリクス実装（オーバーヘッド <1ms/コマンド）
  - [ ] サンプリング/閾値アラート（開発時のみ）
  - [ ] Docs: トラブルシューティング手順

6) フラグの段階ロールアウト計画と露出（P2）
- ブランチ: `chore/docs/flag-rollout-plan`
- 依存: 各機能フラグ実装
- 受け入れ基準:
  - ステージング→限定ON→全体ON の手順とバックアウト条件を文書化
  - dev 設定画面（隠し/DevTools）でフラグ表示（読み取り専用）
- チェックリスト:
  - [ ] Runbook（切替/監視/戻し）のテンプレ化
  - [ ] start-env.sh の例と注意点
  - [ ] 既知の相互作用と制約一覧

7) レガシー経路の除去（安定化後）（P3）
- ブランチ: `refactor/worker/remove-legacy-treemutation`
- 依存: cp-routing-* 安定、e2e グリーン、運用2週間無事故
- 受け入れ基準:
  - フラグとフォールバック経路の削除、ドキュメント・変更履歴更新
  - ロールバック手順は直前タグへのリバート＋データ非破壊を確認
- チェックリスト:
  - [ ] デッドコード検出と削除
  - [ ] 移行後の型通し（`pnpm typecheck`）
  - [ ] 変更履歴（CHANGELOG/リリースノート）

8) Storybook 整備（UIの回帰防止）（P3）
- ブランチ: `chore/storybook/wc-components`
- 依存: wc-impl-align, error-model-unify-ui
- 受け入れ基準:
  - WC 関連コンポーネントの主要状態が Storybook で再現可能
  - Visual regression（任意）準備を行い、Diff をレビュー可能に
- チェックリスト:
  - [ ] 主要コンポーネントの stories 追加
  - [ ] CI との差分検討（スナップショット運用方針）
  - [ ] Docs: 開発フローへの組込

9) Entity Lifecycle V2（基盤）（P1）
- ブランチ: `feat/worker/entity-lifecycle-v2-base`
- 依存: TX/bulk 導入済み
- 受け入れ基準:
  - ドキュメント作成（`packages/runtime-worker/worker/docs/entity-lifecycle-v2.md`）[done]
  - フラグ `WORKER_ENTITY_UNIFIED` 追加（既定OFF）
  - EntityRegistry/EntityHandler/EntityLifecycleManager の雛形実装
  - CommandProcessor からライフサイクル通知（create/duplicate/paste/import/commitWC/discardWC）
  - すべて Tx 内で実行、ユニット緑
- チェックリスト:
  - [ ] feature-flags.ts に `WORKER_ENTITY_UNIFIED`
  - [ ] entity/EntityHandler.ts, EntityRegistry.ts, EntityLifecycleManager.ts 追加
  - [ ] CP→Lifecycle 通知の最小配線（PeerEntity 対象）
  - [ ] ユニット: Peer の WC create/commit/discard/duplicate/import

10) Entity（Peer）実装（P1）
- ブランチ: `feat/worker/entity-peer`
- 依存: 9)
- 受け入れ基準:
  - 1ノード=1エンティティ原則（WC/Trash/通常で1つ）
  - WC create: original→wc を複製（永続）
  - commit: wc→target へアップサート後、wc 側を削除
  - discard: wc 側を削除
  - duplicate/import: NodeId マップに従いバルク作成
  - Tx/バルク/パリティ緑
- チェックリスト:
  - [ ] CoreDB に peerEntities テーブル追加
  - [ ] PeerEntity Handler 実装
  - [ ] ユニット（WC/duplicate/import/commit/discard）
  - [ ] 既存資産のID保持を確認（Import/Duplicateで維持）

11) Entity（Group）実装（P2）
- ブランチ: `feat/worker/entity-group`
- 依存: 10)
- 受け入れ基準: Group の差分適用・Import/Export・E2E 最小
- チェックリスト:
  - [ ] CoreDB に groupEntities テーブル追加
  - [ ] GroupEntity Handler 実装（bulk 差分）
  - [ ] ユニット/E2E
  - [ ] 既存資産のID保持（item ID）

12) Entity（Relational）実装（P2）
- ブランチ: `feat/worker/entity-relations`
- 依存: 11)
- 受け入れ基準: サブツリー内参照のみ複製、外部参照は維持（方針明記）、Import/Export 対応
- チェックリスト:
  - [ ] CoreDB に relations テーブル追加
  - [ ] Relational Handler 実装（IDマップ、rebind）
  - [ ] ユニット/E2E
  - [ ] 外部参照はID参照を残し、解決不可はスキップ集計
  - [ ] Importのエラーポリシー（スキップ集計）をテストに反映

13) Entity V2 ロールアウト（P2）
- ブランチ: `chore/docs/entity-rollout`
- 依存: 9)〜12)
- 受け入れ基準: ステージング限定ON→段階ON手順・バックアウト手順をドキュメント化
- チェックリスト:
  - [ ] Runbook（flags, 監視, 戻し）
  - [ ] E2E包括シナリオ追加（OFF/ON）

### Done（完了）

- WC仕様同期（ADR/用語整備）
  - ブランチ: `chore/docs/wc-spec-sync`（既存ドキュメント整合）
  - 要点: ポリシーC・単一WC共有・エンコード・Tx一貫性の根拠を確定
  
  
- CP ルーティング（create/update/move/remove/recover）
  - ブランチ: `feat/worker/cp-routing-*`
  - 要点: 既定OFFフラグで段階導入、ON時は CP 経由・Undo/Redo 対応、OFF時は非回帰

- WCユーティリティ基盤＋実装アライン（create get-or-create / commit V2）
  - ブランチ: `feat/worker/wc-util-baseline`, `refactor/worker/wc-impl-align`
  - 要点: holder エンコード防衛、get-or-create、commit V2（戻り整流）

- エラーモデル統一（CommandResult 整流）
  - ブランチ: `refactor/worker/error-model-unify`
  - 要点: WorkerのCommandResultをCoreに統一、ドキュメント化

## フラグ運用（共通）

- 起動時固定・既定OFF。`scripts/start-env.sh` から注入し、`config/feature-flags.ts` で一元読取。
- 代表例:
  - `WORKER_USE_CMDPROC_CREATE_UPDATE="0|1"`
  - `WORKER_TRASH_USE_HOLDER="0|1"`
  - `WORKER_USE_CMDPROC_MOVE_REMOVE="0|1"`
  - `WORKER_METRICS_ENABLED="0|1"`

## ロールバック指針

- いずれの段階PRも、フラグOFFで即時切戻し可能な構造を維持
- 既存経路の削除は、ONが十分安定してから最終段で実施

## 今日の着手（運用ログ）

- start: CommandRegistry 雛形導入（skeletonの型/ユーティリティを先行）
- start: WCユーティリティ基盤（holderエンコードの防衛と往復テスト）
- done: 未登録コマンドの `INVALID_OPERATION` 集約（`CommandProcessor.executeCommand`/`isValidCommand` 更新、挙動は登録済みコマンドに限定）
- done: 型テスト追加（`packages/runtime-worker/worker/src/services/command/__tests__/registry.types.test.ts`）
- start: Envelope v1 型の拡張（WorkingCopy/Trash/Copy/Export を CommandMap に追加、挙動非変更）
-. done: runtime-worker スコープで `pnpm typecheck && pnpm test` 実施（テストは sandbox の kill EPERM により終了時に警告、内容はグリーン）
-. blocked: monorepo 全体の `pnpm typecheck` で folder-plugin の型エラーにより失敗（スコープ外）
- start: CP 段階ルーティング（create/update）— フラグ導入とガード分岐実装
- done: `src/config/feature-flags.ts` 追加、`WORKER_USE_CMDPROC_CREATE_UPDATE` を実装（既定OFF）
- done: `TreeMutationService` の create/update をフラグON時に CP 経由へ
- done: `CommandProcessor` の create/update fallback を CoreDB 実処理に置換（戻り同等）
- done: runtime-worker スコープの `pnpm typecheck` グリーン、`pnpm test` は内容パス（終了時EPERMはsandbox由来）
  - done: runtime-worker スコープで `pnpm typecheck && pnpm test` 実施（テストは sandbox の kill EPERM により終了時に警告、内容はグリーン）
  - blocked: monorepo 全体の `pnpm typecheck` で folder-plugin の型エラーにより失敗（スコープ外）

- done: start-env.sh に Worker Flags の可視化を追加（起動時に値を表示）
- done: scripts/env/development.sh / production.sh にフラグ注入例（コメント）を追記
- start: e2e テンプレ追加 `e2e/cp-routing-wc-flow.spec.ts`（describe.skip で雛形作成）
. done: パリティテスト追加 `packages/runtime-worker/worker/src/services/__tests__/cp-routing-parity.test.ts`
. done: Txラッパのユニットテスト追加 `packages/runtime-worker/worker/src/services/__tests__/tx-wrapper.test.ts`
  - create/update: OFF/ON の結果契約（success/状態変化）同等性
  - move/remove: OFF/ON の結果契約（success/状態変化）同等性
  - 備考: Vitest 終了時 EPERM は sandbox 由来（個別テストは合格）

- start: コマンド境界Txの導入（behind-the-flag）
  - done: `CoreDB.runInTx(mode, tables, fn)` を追加（共通Txラッパ）
  - done: `FEATURE_FLAGS.WORKER_TX_ENABLED` を追加（既定OFF）
  - done: `CommandProcessor.executeCommand()` をTxラッパで包む（デフォルト`nodes`）
  - done: `CoreDB.updateNode()` の永続化欠落を補修（put＋イベント発火）
  - note: 既存の局所Tx（WC get-or-create内）は親Txに吸収されるためこのまま維持（後段で整理）

- start: 大量操作のバルク化（チャンク処理）
  - done: moveNodes/remove/recover をバルク更新・削除へ置換（chunks = PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE）
  - done: pasteNodes を配列化→ bulkCreateNodes（チャンク）へ置換（単一は単発）
  - done: importNodes（ImportExportService）をレベルごと一括作成→子再帰へ置換（チャンク）
  - done: duplicateNodes を CoreDB.duplicateSubtree ベースに切替（内部で bulkCreateNodes）
  - done: 旧 private duplicateBranch を削除（未使用のため整理）

- start: 観測性の最小実装（開発時）
  - done: utils/metrics.ts を追加し、コマンド別レイテンシを収集（count/avg/max）
  - done: CommandProcessor で計測フック（FEATURE_FLAGS.WORKER_METRICS_ENABLED 配下）

### 次のチェックポイント（本日）

- CommandRegistry 雛形導入
  - [x] `services/command/registry.types.ts` の型土台を追加
  - [x] `services/command/envelope.util.ts` の createEnvelope<K>() 叩き台を追加
  - [x] `pnpm typecheck` が通ることを確認（コードは挙動非変更）

- WCユーティリティ基盤
  - [x] `HOLDER_NAME_TAB` 定数と encode/decode の型整備・公開
  - [x] ラウンドトリップの最小ユニットテストを確認（既存 test 通過）
  - [x] TAB混入の失敗ケーステストを確認（既存 test 通過）

### 進捗メモ

- runtime-worker の型検証で `decodeWorkingCopyHolderName` がブランド型 `NodeId` と不一致だったため、`@hierarchidb/common-type` の `NodeId` を利用するよう util を修正し、返却値を `as NodeId` で正規化（実行時挙動は非変更）。

> 以降の進捗は、このセクションに「start/done/blocked」を時系列で追記します。
