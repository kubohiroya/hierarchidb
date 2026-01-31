# Build進捗パネルの共通化（Shape/Route）

このExecPlanは生きた文書であり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を更新し続ける必要がある。

本ExecPlanは `PLANS.md`（リポジトリ直下）に従って維持される。

## Purpose / Big Picture

Shape/Route の Step5（Build 進捗）を同一の共通パネルで表示できるようにし、ステージ進捗・タスクサマリー・制御ボタンのUIが統一されるようにする。実装後、Shape/Route のビルド画面が同じコンポーネントを使い、表示仕様が揃っていることを確認できる。

## Progress

- [x] (2026-01-31 13:22 JST) 既存のShape/RouteのBuild進捗UIの責務とデータ構造を整理する。
- [x] (2026-01-31 13:24 JST) 共通パネルの設計（Props/表示要素/制御イベント）を確定しDecision Logに記録する。
- [x] (2026-01-31 13:34 JST) 共通パネルを `packages/components` に実装する。
- [x] (2026-01-31 13:38 JST) Shape/Route のUIを共通パネルへ移行する。
- [x] (2026-01-31 13:41 JST) `pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` を実行して成功を確認する。

## Surprises & Discoveries

- Observation: なし。
  Evidence: なし。

## Decision Log

- Decision: 共通パネルは `packages/components/src/BuildProgressPanel.tsx` に追加し、既存の `BuildStepPanel` を内部で利用する方針とする。
  Rationale: 既存の `@hierarchidb/components` がBuild系のUI部品を保持しており、Shape/Routeともに依存済みであるため共有が自然。
  Date/Author: 2026-01-31 / assistant

- Decision: 共通パネルはBuildStepPanelの外枠レイアウトとフッターのみを共通化し、Shapeのタスク一覧はプラグイン内に残す。
  Rationale: タスク一覧はShape専用のAtomや型に依存しており、短期での共通化は影響範囲が大きいため。
  Date/Author: 2026-01-31 / assistant

## Outcomes & Retrospective

- BuildProgressPanel を共通追加し、Shape/Route が同一パネルでBuildStepPanelを描画するようになった。タスク一覧はShape側に残しつつ、フッター領域を共通化できた。

## Context and Orientation

ShapeのBuild進捗UIは `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx` と `ShapeBuildStep.tsx` が中心で、`@hierarchidb/ui-batch-progress` のデータとJotai atomに同期して表示を構築している。RouteのBuild進捗UIは `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` が中心で、`BuildStepPanel` を使ったステージ進捗表示と独自のステータス表示を行っている。共通化では、両者が同一の「進捗パネル」コンポーネントを使い、BuildStepPanelの外枠レイアウトとフッター領域を共有する。Shape側の詳細タスク表示は既存のまま維持し、Route側は簡易表示のまま共通パネルを使用する。

`packages/components/src/BuildStepPanel.tsx` は既にステージ進捗UIの共通パーツとして利用されているため、新しい共通パネルもここに配置する。

## Plan of Work

まず、Shape/Routeで必要な表示要素を整理し、共通パネルが受け取るPropsを設計する。PropsはBuildStepPanelの既存Propsに加えて、パネル外側に配置するフッター領域（ダイアログや通知）を渡せるようにする。

次に、`packages/components/src/BuildProgressPanel.tsx` を追加し、既存の `BuildStepPanel` を内側で呼び出しながら、Shape/Routeで共通に使える外枠レイアウトを提供する。タスク一覧や詳細サマリーは共通化対象から外し、Shape側で従来どおり表示し続ける。

最後に、Shape/RouteのStep5を新パネルに切り替える。Shape側は `ShapeBuildProgressPanel` で共通パネルを用いて既存のUIを保持し、Route側は `RouteBuildStep.tsx` から共通パネルを呼び出してダイアログ類をフッターへ移す。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` とする。

1) 既存UIの必要要素を整理する
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx`
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildStep.tsx`
   - `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`

2) 共通パネルを追加する
   - `packages/components/src/BuildProgressPanel.tsx` を新規作成
   - `packages/components/src/index.ts` にexportを追加

3) Shape/Routeを共通パネルへ切り替える
   - `plugins/shape-plugin/src/ui/components/build-progress/ShapeBuildProgressPanel.tsx` を共通パネル利用へ変更
   - `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` で共通パネルを使用

4) 型チェックを実行する
   - `pnpm --filter @hierarchidb/shape-plugin typecheck`
   - `pnpm --filter @hierarchidb/route-plugin typecheck`

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` と `pnpm --filter @hierarchidb/route-plugin typecheck` が exit 0 で完了し、Shape/RouteのStep5画面が共通パネルを利用していることをコード上で確認できることを受け入れ基準とする。既存のステージ表示・進捗表示が同一のUIコンポーネントから生成されていることが確認できる必要がある。

## Idempotence and Recovery

共通パネルの追加と参照切替は反復実行が可能であり、差分をrevertすれば元の実装に戻せる。万一共通パネルで表示が崩れた場合は、各プラグイン側の変更をrevertして従来のUIへ戻す。

## Artifacts and Notes

- 変更後に `packages/components/src/index.ts` に `BuildProgressPanel` のexportが追加されていることを確認する。
- `RouteBuildStep.tsx` と `ShapeBuildProgressPanel.tsx` から共通パネルの使用が確認できることを示す。

## Interfaces and Dependencies

- 新規コンポーネント: `packages/components/src/BuildProgressPanel.tsx`
  - Propsは `BuildStepPanel` が必要とするステージ定義と進捗値を必ず含む。
  - 追加の `footer` はパネルの下部に配置され、Shape/Routeのダイアログ類を統一的に配置できる。
- 依存: `@hierarchidb/components` は `@mui/material` と `@mui/icons-material` を使用済みなので同一のUIライブラリを使う。

---
変更履歴: 初版作成（2026-01-31, assistant）。
変更履歴: 進捗更新と方針微調整を反映（2026-01-31, assistant）。
