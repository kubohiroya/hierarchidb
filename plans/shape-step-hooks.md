# Shape Plugin Step Components Logic Extraction

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

Shape プラグインの Step2 以降の UI コンポーネントは現在、状態管理とロジックがコンポーネント内部に混在している。今回の変更で各ステップのロジックをカスタムフックへ移し、コンポーネントは表示専用として扱える状態にする。これにより UI 変更とロジック変更の分離が進み、GIS 系プラグインでの共通化や再利用がしやすくなる。動作確認は既存の UI と同じ挙動が維持されること、typecheck が通ることによって判断する。

## Progress

- [x] (2025-12-21 22:01) plan 作成と対象コンポーネントの棚卸し。
- [x] Step2: ShapeCountrySelectionStep のロジック抽出とフック化。
- [x] Step3: ShapeBuildConfigStep と Download/Extraction/Tile 各セクションのロジック抽出。
- [x] Step4: ShapeBuildStep のロジック抽出。
- [x] Step5: ShapePreviewStep のロジック抽出。
- [x] 付随コンポーネント（ErrorDisplay, BatchRecoveryDialog, ShapeDataSourceStep）のロジック外出し整備。
- [x] (2025-12-21 22:19) typecheck 実行と挙動確認ログの記録。

## Surprises & Discoveries

No discoveries yet.

## Decision Log

- Decision: 各 Step のロジックは `plugins/shape-plugin/src/ui/hooks` に集約し、コンポーネントはフックの戻り値を使って描画する形式に統一する。
  Rationale: 既存の hooks 配下に揃えることで import と探索が簡単になり、他プラグインへの共通化検討時にも再利用しやすい。
  Date/Author: 2025-12-21 Codex

## Outcomes & Retrospective

Typecheck が通過し、Step2 以降のロジック外出しが完了した。

## Context and Orientation

対象は `plugins/shape-plugin/src/ui/components` にある Step コンポーネント群である。Step2 以降は `ShapeCountrySelectionStep.tsx`、`ShapeBuildConfigStep.tsx`、`DownloadConfigSection.tsx`、`ExtractionConfigSection.tsx`、`VTConfigSection.tsx`、`ShapeBuildStep.tsx`、`ShapePreviewStep.tsx` が該当する。Step1 は `ShapeDataSourceStep.tsx` だが、要請により同様のロジック外出しを実施する。補助 UI として `BatchRecoveryDialog.tsx` と `ErrorDisplay.tsx` が存在する。ロジック外出し先は `plugins/shape-plugin/src/ui/hooks` を基本とし、既存の hooks export (`plugins/shape-plugin/src/ui/hooks/index.ts`) を更新する。

この作業では UI の表示と挙動は変えず、コンポーネントは「受け取った props を描画するだけ」になるように設計する。ロジックはフックで完結し、イベントハンドラはフックが返す関数を使う。

## Plan of Work

まず Step2 から順に、各コンポーネント内の状態管理・派生データ・ハンドラを抽出し、新規の `useShape*` 系フックへ移す。フックは input として既存の `data`/`onChange` を受け取り、描画に必要なデータとイベントハンドラを返す。コンポーネントはフックの戻り値を使って表示だけを担う。

次に Step3 の設定セクション（Download/Extraction/Tile）を同様に処理し、設定値の正規化や Ephemeral DB の集計、ボタンハンドラをフックへ移す。Step4 の BuildProgress と Step5 の Preview は状態が多いため、フック側で state と effect をまとめる。

最後に Step1 と補助コンポーネントにも同様の外出しを適用し、hooks の export を整理する。型チェックを行い、TASKS の運用ログに結果を記録する。

## Concrete Steps

1) `plugins/shape-plugin/src/ui/hooks` に各 Step 用フックファイルを追加する。
2) `plugins/shape-plugin/src/ui/components/steps/*.tsx` をフック利用へ書き換える。
3) `plugins/shape-plugin/src/ui/components/BatchRecoveryDialog.tsx` と `ErrorDisplay.tsx` のロジックを最小化する。
4) `plugins/shape-plugin/src/ui/hooks/index.ts` に新フックの export を追加する。
5) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、結果を運用ログへ記録する。

## Validation and Acceptance

Typecheck が成功し、各 Step の UI で表示や操作が従来と同じであることを確認する。確認は `pnpm --filter @hierarchidb/shape-plugin typecheck` の成功ログで行う。可能なら Step2〜Step5 の UI を開き、入力・プレビュー・ビルドが従来通りに動作することを目視確認する。

## Idempotence and Recovery

この作業は何度でも再実行可能である。問題が起きた場合は変更したフックファイルと UI コンポーネントの差分を revert すれば元の状態に戻る。各 Step ごとに差分を小さくし、段階的に戻せるようにする。

## Artifacts and Notes

実行したコマンドと結果は GitHub Issue の運用ログへ記載する。

## Interfaces and Dependencies

フックは React の標準フックのみを使い、既存の `useShapeProgress` や `useShapeBuildTasks` などの hooks を再利用する。新しいフックは `plugins/shape-plugin/src/ui/hooks` に配置し、UI コンポーネントはそれを import する。フックの戻り値は表示に必要な最低限の props とイベントハンドラに限定する。

Plan update note: 新規 ExecPlan を追加し、Step2 以降のコンポーネントロジック抽出手順を定義した。
