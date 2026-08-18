# Shape Build Session SSOT Refactor

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `/PLANS.md` and must be maintained in accordance with its rules.

## Purpose / Big Picture

Shape Step5 の進捗表示は、現在 `tasksLoading`・`startPending`・`startPendingHold`・`buildStatus` など複数の状態を別々に見て判定しており、UI 表示の真実源（SSOT）が分散している。これを「単一の表示状態（task list view phase）」に統合し、`No tasks yet` / `Skeleton` / `Task list` の切替を一貫させる。完了後は、再ビルド開始直後の空表示や終端一括反映を避け、初回 snapshot 到着までの状態が常に可視化される。

## Progress

- [x] (2026-02-28 20:05 JST) Issue #642 起票、Project `In Progress` 設定、専用ブランチ作成、当時のローカル運用ログ追記を完了（ローカル台帳は現在廃止）。
- [x] (2026-02-28 20:09 JST) 既存の build-progress 状態経路（task sync, stage state, panel controller）を再調査し、SSOT 化の差し込み点を特定。
- [x] `task list view phase` 型と atom を追加し、`useShapeBuildStepStageState` で phase を単一路で算出する。
- [x] `useShapeBuildStep` と atom sync 経路で phase を伝搬し、`ShapeBuildProgressPanelController` の skeleton 判定を phase ベースへ置換する。
- [x] 既存の分散判定（`refreshTasks` 経路を含む）を縮退し、UI 実運用経路から削除する。
- [x] (2026-02-28 20:49 JST) Start（旧 Resume ラベル操作を含む）実行経路を `startBuildSession` 単一路へ統合し、shape UI から旧 resume API 分岐を撤去。
- [x] unit/integration test を更新し、`running + empty` で `No tasks yet` が出ないことと snapshot 到着後の遷移を固定する。
- [x] `pnpm -w turbo run typecheck/test --filter @hierarchidb/shape-plugin` で検証し、結果を Issue/TASKS に記録する。

## Surprises & Discoveries

- Observation: `refreshTasks` は当初型定義と引数経路に残存していたが、実運用経路から外しても subscription snapshot/progress だけで UI が安定した。
  Evidence: `plugins/shape-plugin/src/ui/components/build-progress/internal/*` から `refreshTasks` 参照を除去後も typecheck/test が green。
- Observation: `Delete tile data` は task list を即クリアするが `tasksLoading` は再点灯しない。
  Evidence: `useShapeBuildCacheActions.handlers.ts` の VT 削除経路は `setBuildTasks/setPersistedTasks` を更新するのみ。

## Decision Log

- Decision: まず「表示の SSOT」を `task list view phase` として追加し、UI 判定の統一を先に行う。
  Rationale: Worker API や build control 制御の全面改修より先に、ユーザー可視の不整合を最小リスクで解消できるため。
  Date/Author: 2026-02-28 / Codex
- Decision: `refreshTasks` は UI 実運用経路から廃止し、snapshot/progress 購読経路を唯一の進捗真実源とする。
  Rationale: `taskListViewPhase` 統合後、`refreshTasks` なしで表示整合が維持できることを確認できたため。
  Date/Author: 2026-02-28 / Codex
- Decision: Shape UI の build request は `startBuildSession` 単一APIで扱い、`Resume` はUIラベルに限定する。
  Rationale: `build-session-orchestrator-state-transitions.md` の単一エントリ契約（Single Entry Semantics）に合わせ、制御語彙と実装を一致させるため。
  Date/Author: 2026-02-28 / Codex

## Outcomes & Retrospective

- Shape Step5 の表示状態は `taskListViewPhase` を真実源として単一路化され、`running + empty` 区間で `No tasks yet.` が先出しされる不整合を解消した。
- `refreshTasks` 依存を UI 実運用経路から撤去し、`snapshot/progress` 購読を進捗表示の唯一経路として固定した。
- Build control 語彙は `start/pause/cancel` に統一され、Start（旧 Resume ラベル操作を含む）は `startBuildSession` 単一APIへ集約された。
- Verification (2026-02-28 JST):
  - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` -> exit 0
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx` -> exit 0 (17 passed)
  - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTaskSnapshotProgressState.unit.test.tsx` -> exit 0 (28 passed)
  - `pnpm policy:build-session-ui-vocabulary` -> exit 0
  - `pnpm policy:build-session-resume-zero-presence` -> exit 0
- Residual risk: none identified for this plan scope; remaining work is operational close-out on Issue/Project tracking.

## Context and Orientation

Shape Step5 の進捗 UI は次の経路で構成される。

`useShapeBuildTaskSnapshotProgressState` が Worker の `snapshot/update` を受け、task list atom (`tasksAtom`, `tasksLoadingAtom`) を更新する。`useShapeBuildStepStageState` は task list と build status を組み合わせて `displayTasks` と `buildStatus` を生成する。`useShapeBuildStep` はこれを `ShapeBuildStepAtomSync` へ渡し、Jotai atom 群を更新する。最後に `ShapeBuildProgressPanelControllerBaseStateDataCore` と `BuildProgressStageContentState` が skeleton/empty/list を判定して描画する。

問題は「判定に使う状態」が複数箇所に分散している点である。`tasksLoading`, `controls.startPending`, `startPendingHold`, `summary.buildStatus`, `tasksByStage` が別々に参照され、同時に整合しない瞬間が発生する。今回の refactor では、表示専用の phase を算出して UI は phase のみを参照する。

## Plan of Work

最初に `shapeBuildProgressAtoms.ts` へ `TaskListViewPhase` 型と `taskListViewPhaseAtom` を追加する。phase は `idle | awaitingSnapshot | streaming | settledEmpty` の4値とし、意味を固定する。次に `useShapeBuildStepStageState.ts` で phase を算出する。算出は `buildStatus`, `displayTasks.length`, `isLoading`, `hasAnyTaskSnapshot` を入力にして pure function 化し、テスト可能にする。

続いて `useShapeBuildStepLogic.impl.ts` の返り値へ phase を追加し、`useShapeBuildStepAtomSync.ts` と `useShapeBuildStepAtomSyncEffects.ts` で atom へ同期する。`useShapeBuildProgressPanelControllerBaseStateDataCore.ts` では `isTasksLoadingForDisplay` を phase ベースに置換し、`BuildProgressStageContentState` の skeleton 判定は `phase === 'awaitingSnapshot' || phase === 'streaming' && hasTasks===false` を利用する。最後に分散した補助フラグのうち役割が重複するものを削除または縮退する。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb`。

1. まず型と atom を追加する。
   - `plugins/shape-plugin/src/ui/atoms/shapeBuildProgressAtoms.ts`
2. 次に phase 算出関数と stage state 出力を追加する。
   - `plugins/shape-plugin/src/ui/components/build-progress/internal/useShapeBuildStepStageState.ts`
3. phase を hook 返り値と atom sync に伝搬する。
   - `plugins/shape-plugin/src/ui/components/build-progress/internal/useShapeBuildStepLogic.impl.ts`
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildStep/useShapeBuildStepAtomSync/useShapeBuildStepAtomSync.ts`
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildStep/useShapeBuildStepAtomSync/useShapeBuildStepAtomSyncEffects.ts`
4. panel controller と stage content の判定を phase ベースへ置換する。
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBaseState/useShapeBuildProgressPanelControllerBaseStateDataCore.ts`
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel/BuildProgressStageContent/useBuildProgressStageContentState.ts`
5. テスト更新。
   - `plugins/shape-plugin/src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx`
   - 必要に応じて `plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildTaskSnapshotProgressState.unit.test.tsx`
6. 検証コマンド。
   - `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin`
   - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/components/build-progress/ShapeBuildProgressPanel.unit.test.tsx`
   - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run src/ui/__tests__/hooks/unit/useShapeBuildTaskSnapshotProgressState.unit.test.tsx`

## Validation and Acceptance

受け入れは次で判定する。

- `buildStatus=running` かつ task list が空の間は、`No tasks yet.` が出ず skeleton が表示される。
- 初回 snapshot 到着後は task list が表示され、progress update で逐次更新される。
- `buildStatus=idle` で未開始の場合のみ `No tasks yet.` が許可される。
- 対象テストが成功し、typecheck が通る。

## Idempotence and Recovery

この計画の編集はすべて加法的に進める。途中失敗時は `git restore <file>` でファイル単位で戻し、再適用する。表示判定が壊れた場合は phase 判定差分のみを revert すれば従来動作へ復帰できる。既存の Worker API 署名は変えないため、互換リスクは限定的。

## Artifacts and Notes

- 進捗ログ・検証ログは GitHub Issue #642 に集約する。
- #641 の最小修正試作は stash `wip-641-skeleton-fix` に退避済み。必要なら後で比較参照する。

## Interfaces and Dependencies

`TaskListViewPhase` は UI 表示専用の抽象状態であり、Worker の transport 状態そのものではない。最終的に以下インターフェイスを満たす。

- `type TaskListViewPhase = 'idle' | 'awaitingSnapshot' | 'streaming' | 'settledEmpty'`
- `useShapeBuildStepStageState` の return に `taskListViewPhase: TaskListViewPhase` を追加
- `useShapeBuildStep` の return に `taskListViewPhase` を追加
- atom: `taskListViewPhaseAtom`
- `ShapeBuildProgressPanel` 側では skeleton/empty 判定に `taskListViewPhaseAtom` を参照し、`tasksLoadingAtom` 直接依存を減らす

Revision note (2026-02-28 20:09 JST): Initial ExecPlan created for #642 and aligned with current codebase observations.
