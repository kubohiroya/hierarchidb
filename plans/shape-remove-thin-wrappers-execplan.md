# shape-plugin の薄いラッパーを削除して構成を簡素化する

本 ExecPlan は生きたドキュメントである。Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を常に更新する。

この plan はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

shape-plugin には独自の責務が薄く、単に props を流すだけのラッパーや薄いフックが存在する。これらを削除し、呼び出し元で直接扱うことで構成を単純化し、理解コストを下げる。変更後は UI の表示や挙動が維持され、参照構造が簡潔になる。検証は shape-plugin typecheck の成功で行う。

## Progress

- [x] (2026-01-29 08:22 JST) retired local task log にタスクを追加して着手ログを記載。
- [x] (2026-01-29 08:28 JST) 指定候補ファイルの現状責務と置換先を確認。
- [x] (2026-01-29 08:30 JST) ラッパー/薄いフックを削除し、呼び出し構成を統合。
- [x] (2026-01-29 08:31 JST) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。
- [x] (2026-01-29 08:31 JST) retired local task log に完了ログを記載。

## Surprises & Discoveries

- Observation: まだなし。
  Evidence: なし。

## Decision Log

- Decision: Build Progress の stage/task 表示ロジックは `ShapeBuildProgressPanel` 内部に統合する。
  Rationale: 外部コンポーネントは薄いラッパーだったため、単一ファイルで完結させた方が理解しやすい。
  Date/Author: 2026-01-29 (Codex).
- Decision: AtomSync は `ShapeBuildStep` 内部の非公開コンポーネントとして統合する。
  Rationale: Provider 配下で動かす必要があるが、外部公開する必要はないため。
  Date/Author: 2026-01-29 (Codex).

## Outcomes & Retrospective

- Outcome: 薄いラッパー群を削除して Build Progress の表示/同期を統合し、呼び出し構成が簡素化された。shape-plugin typecheck は成功した。

## Context and Orientation

対象はユーザー指定の薄いラッパー群。削除/統合対象は以下:

- `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressStageContent.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressAtomSync.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/TaskProgressSummaryCard.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/TaskProgressBar.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/useBuildStages.tsx`
- `plugins/shape-plugin/src/ui/components/build-progress/useBuildStatus.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/useBatchCommand.ts`
- `plugins/shape-plugin/src/ui/components/build-progress/useBatchSessionActions.ts`
- `plugins/shape-plugin/src/ui/components/preview/useTransformErrorTable.ts`

## Plan of Work

1) 各ファイルを読み、実質的な責務があるか確認する。必要であれば統合先を決める。
2) ラッパーコンポーネント/フックを削除し、呼び出し側で直接実装する。
3) import/export を整理し、参照の壊れを解消する。
4) typecheck を実行し、GitHub Issue にログを残す。

## Concrete Steps

- ファイルを順に開き、責務を確認。
- `ShapeBuildProgressStageContent` は `ShapeBuildProgressPanel` で直接 `BuildStepStagePanel` を構築する方向で統合。
- `ShapeBuildProgressAtomSync` は `ShapeBuildStep` 内に統合し、コンポーネント削除。
- `TaskProgressSummaryCard` / `TaskProgressBar` は `ShapeBuildProgressPanel` で直接レンダリングする方向で統合。
- `useBuildStages` / `useBuildStatus` / `useBatchCommand` / `useBatchSessionActions` は呼び出し側で直接 atom/API を扱う。
- `useTransformErrorTable` は利用側のプレビューコンポーネントで直接状態管理する。
- `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0。
- UI の見た目と操作が維持されている。

## Idempotence and Recovery

問題があれば対象ファイルの削除/変更を revert し、元の構成へ戻す。

## Artifacts and Notes

想定ログ:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- 既存の外部API/props 形状は変えず、呼び出し構成だけを簡素化する。

Plan updated on 2026-01-29 to capture removal完了と統合方針。
