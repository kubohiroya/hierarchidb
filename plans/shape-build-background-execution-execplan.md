# Shape Build Step A: Screen Leave Pause (No Auto Resume)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked in at `PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

Shape のビルド画面から離れたときにビルドを停止し、画面に戻っても自動で再開しない状態を実現する。ユーザーは Step5 を離れるとビルドが一時停止し、復帰時には「停止中」であることが確認できる。停止理由は明示的に保存され、後続フェーズ（b/c）で自動再開判定に使える基盤になる。

## Progress

- [x] (2026-02-05 12:15 JST) ExecPlan を作成し、対象ファイルの位置と狙いを整理した。
- [x] (2026-02-05 17:10 JST) stopReason を ShapeBuildSessionRecord/BuildSessionRecord に追加し、マッパと永続化を更新する。
- [x] (2026-02-05 17:10 JST) pauseBatchSession に停止理由を渡せるよう WorkerAPI/bridge/shape worker を更新する。
- [x] (2026-02-05 17:10 JST) 画面離脱時の pause を stopReason=route-leave で呼び出すよう UI を更新する。
- [x] (2026-02-05 17:20 JST) 必要な build/typecheck を実行し、結果を記録する。

- [x] (2026-02-05 18:51 JST) Comlink+fake-indexeddb の shape build pause 結合テストを追加し単体実行でパス。

## Surprises & Discoveries

- Observation: useShapeBuildAutoResume は pagehide/unload/アンマウント時に pause を呼ぶが、停止理由の保存は行っていない。
  Evidence: `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildAutoResume.ts` の cleanup で `handlePause()` を呼び出している。

## Decision Log

- Decision: 停止理由は ShapeBuildSessionRecord/BuildSessionRecord に追加して永続化し、UI から pause 時に理由を渡して記録する。
  Rationale: stopReason を b フェーズの自動再開判定に使うため、セッションの永続領域に保持するのが最小で一貫性が高い。
  Date/Author: 2026-02-05 / Codex

- Decision: hidb-ephemeral の sessions/buildTasks/transformCache は Ephemeral 型定義と形が異なるため、UI/worker 側で正規化 or unknown cast を行って shape 専用型へ揃える。
  Rationale: Ephemeral 側に shape-store 依存を持ち込まず、既存の共通 DB 型を保ったまま typecheck を通すため。
  Date/Author: 2026-02-05 / Codex

- Decision: hidb-ephemeral の型を shape のセッション/タスク/エラーに合わせ、unknown cast ではなく型整合と検証で取り回す。
  Rationale: 型の正しさを担保しつつ、route など他ドメインの legacy 進捗は union で保持するため。
  Date/Author: 2026-02-05 / Codex

## Outcomes & Retrospective

- 未記入（作業完了時に記載する）。

## Context and Orientation

Shape のビルド進行は UI 側の Step5（Build）で `useShapeBuildStep` と `useShapeBuildAutoResume` を使って制御される。`useShapeBuildAutoResume` は pagehide/unload/アンマウント時に pause を呼ぶが、停止理由や永続化のための追加情報は渡していない。Worker 側の shape batch API は `plugins/shape-plugin/src/worker/api.ts` の `invokeBatchCommand` で pause/resume を実装している。セッション永続化は runtime-worker の `ShapeMutationService` が `hidb-ephemeral.sessions` に `BuildSessionRecord` を書き込む。現状の `ShapeBuildSessionRecord` / `BuildSessionRecord` には stopReason がないため、理由を記録できない。

関連ファイル（必ず開いて確認する）:
- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildAutoResume.ts`
- `packages/ui/worker-client/src/workerBridge.ts`
- `packages//src/WorkerAPI.ts`
- `plugins/shape-plugin/src/worker/api.ts`
- `packages//src/shapeDbTypes.ts`
- `packages//src/ShapeDB.ts`
- `plugins/shape-plugin/src/services/batch/shapeSessionMappers.ts`
- `packages/runtime-worker/src/services/ShapeMutationService.ts`

## Plan of Work

まず stopReason をセッション型に追加し、Shape の build セッションが停止理由を永続化できるようにする。`ShapeBuildSessionRecord` と `BuildSessionRecord` に stopReason を追加し、マッパ (`shapeSessionMappers.ts` と `ShapeMutationService`) で stopReason を相互変換・保存する。stopReason の値は `route-leave`, `user-pause`, `failed`, `completed`, `unknown` を使用する。

次に pauseBatchSession へ停止理由を渡せるように Worker API を拡張する。`WorkerAPI.pauseBatchSession` と `workerBridge.pauseBatchSession` を `reason?: string` 付きで拡張し、shape worker の `invokeBatchCommand` に `stopReason` を payload で渡す。shape worker 側で pause を実行したあと、`ShapeMutationService.updateBuildSession` を使って stopReason をセッションに書き込む。

最後に UI の画面離脱時 pause を `stopReason=route-leave` で呼ぶ。`useShapeBuildAutoResume` の pagehide/unload/cleanup で呼び出す pause に理由を渡すように変更し、手動 pause ボタンでは `stopReason=user-pause` を渡す。これにより a フェーズの要件（離脱で停止・復帰で自動再開なし）が成立する。自動再開については `autoResumeBuild` を使った経路のみが対象であり、a では stopReason のみを保存し auto resume は行わない。

## Concrete Steps

1) セッション型に stopReason を追加する。
   - `packages//src/shapeDbTypes.ts` の `ShapeBuildSessionRecord` に `stopReason?: 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown'` を追加する。
   - `packages//src/ShapeDB.ts` の `BuildSessionRecord` に同様の `stopReason?: ...` を追加する。

2) マッパと永続化に stopReason を流す。
   - `plugins/shape-plugin/src/services/batch/shapeSessionMappers.ts` の `toBuildSessionRecord` / `toBuildSessionUpdates` / `toShapeBuildSessionRecord` / `toShapeBuildSessionUpdates` に stopReason を反映する。
   - `packages/runtime-worker/src/services/ShapeMutationService.ts` の `toBuildSessionRecord` / `toBuildSessionUpdates` に stopReason を反映する。

3) pauseBatchSession に stopReason を渡せるようにする。
   - `packages//src/WorkerAPI.ts` の `pauseBatchSession` を `pauseBatchSession(nodeType, nodeId, reason?: string)` に拡張する。
   - `packages/ui/worker-client/src/workerBridge.ts` の `pauseBatchSession` を reason 付きで呼び出せるようにする。
   - `plugins/shape-plugin/src/worker/api.ts` の `invokeBatchCommand('session/pause')` に `stopReason` を追加し、pause 実行後に `ShapeMutationService.updateBuildSession` で `stopReason` を保存する。

4) UI の画面離脱/手動 pause に理由を渡す。
   - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildStep.ts` の `handlePause` に `reason?: 'route-leave' | 'user-pause'` を追加し、manual pause は `user-pause` を渡す。
   - `plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildAutoResume.ts` の離脱/アンマウント経路で `handlePause('route-leave')` を呼ぶ。

5) 検証。
   - `pnpm --filter @hierarchidb/shape-api build`
   - `pnpm --filter @hierarchidb/shape-store build`
   - `pnpm --filter @hierarchidb/shape-plugin typecheck`
   - `pnpm --filter @hierarchidb/runtime-worker typecheck`

## Validation and Acceptance

- Step5 を開いてビルドを開始し、別ステップへ移動する。ビルドが停止状態になっていることを確認する。
- Step5 へ戻っても自動再開しないことを確認する。
- `hidb-ephemeral.sessions` に stopReason=route-leave が保存されていること（Dexie/ログなど）を確認する。
- 上記の build/typecheck が exit 0 であることを確認する。

## Idempotence and Recovery

- stopReason の追加は型拡張であり、再実行しても破壊的な挙動はない。
- もし不具合が出た場合は、stopReason 追加と pause の reason 経路を戻して元の pause に戻す。

## Artifacts and Notes

- 実行コマンド例（出力は簡略でよい）:
  pnpm --filter @hierarchidb/shape-api build
  pnpm --filter @hierarchidb/shape-store build
  pnpm --filter @hierarchidb/shape-plugin typecheck
  pnpm --filter @hierarchidb/runtime-worker typecheck

## Interfaces and Dependencies

- `WorkerAPI.pauseBatchSession` のシグネチャ拡張は UI/worker 両側に反映する。
- stopReason の値は文字列 union として shape-api/shape-store で定義し、UI からはその文字列を使用する。
- build セッション永続化は `hidb-ephemeral.sessions` を利用する。

Plan revised on 2026-02-05: initial ExecPlan created to implement phase a (screen-leave pause) and stopReason persistence.
