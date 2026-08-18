# shape-plugin の Step5 集計共通化と shapePipeline 分割

本 ExecPlan は生きたドキュメントである。Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を常に更新する。

この plan はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

Step5(Build Progress) の集計ロジックが shape-plugin と ui-build で重複しており、変更時に不整合が起きやすい。共通ユーティリティへ集約し、UI の進捗/サマリ算出が単一ルールで動くようにする。併せて `useShapeBuildStep` の責務を分割し、表示/進捗/再開/タイマーの役割を明確にする。さらに `runShapePipeline` をステージ単位のランナーへ分割して orchestrator を薄くし、保守性とレビュー性を向上させる。

## Progress

- [x] (2026-01-29 09:12 JST) retired local task log にタスク追加と着手ログを記載。
- [x] (2026-01-29 09:25 JST) Step5 集計ロジックを共通ユーティリティへ集約。
- [x] (2026-01-29 09:25 JST) useShapeBuildStep の責務を分割フックへ移行。
- [x] (2026-01-29 09:25 JST) runShapePipeline をステージ単位ランナーへ分割。
- [x] (2026-01-29 09:28 JST) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。
- [x] (2026-01-29 09:28 JST) retired local task log に完了ログを記載。

## Surprises & Discoveries

- Observation: なし。
  Evidence: なし。

## Decision Log

- Decision: 集計ユーティリティは `@hierarchidb/ui-build-progress` に集約し、shape-plugin から参照する。
  Rationale: UI 側の Task 進捗集計と同一のロジックで揃えるため。
  Date/Author: 2026-01-29 (Codex).

## Outcomes & Retrospective

- Outcome: Step5 の集計ロジックを ui-build のユーティリティへ集約し、useShapeBuildStep を進捗/表示/サマリ/タイマーの責務に分割。shapePipeline はステージ単位の関数で orchestrator が簡潔化された。

## Context and Orientation

対象は `plugins/shape-plugin/src/ui/components/build-progress` と `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`、`plugins/shape-plugin/src/services/vt/shapePipeline.ts`。Step5 の集計/表示/自動再開/タイマーは役割別にフック分離し、従来挙動を維持する。

## Plan of Work

1) Step5 集計ロジックを共通ユーティリティへ移動し、shape-plugin と ui-build から参照する。
2) `useShapeBuildStep` のロジックを「進捗計算」「表示ラベル」「自動再開/タイマー」「サマリ生成」単位で分割フック化する。
3) `runShapePipeline` をステージ単位ランナーに分割し orchestrator を薄くする。
4) typecheck を実行し、GitHub Issue にログを残す。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0。
- Step5 の表示と挙動が従来と一致する。

## Idempotence and Recovery

変更は段階的に進め、問題があれば該当パッチを revert して従来ロジックに戻す。

## Artifacts and Notes

想定ログ:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- 共通ユーティリティは ui-build から export し、shape-plugin で import する。
- 既存の UI/Worker API には手を入れず、参照の入れ替えに留める。
