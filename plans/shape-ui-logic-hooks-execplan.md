# shape-plugin UI のロジックをカスタムフックへ分離する

本 ExecPlan は生きたドキュメントである。Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を常に更新する。

この plan はリポジトリ直下の `PLANS.md` に従って維持する。

## Purpose / Big Picture

shape-plugin の UI コンポーネントには、描画ロジックとデータ加工/状態管理が混在している箇所がある。ロジックをカスタムフックへ抽出し、UI を入力依存の描画に集中させることで、テスト容易性と保守性を高める。変更後は UI コンポーネントがより薄くなり、ロジック変更の影響範囲が明確になる。検証は shape-plugin typecheck の成功と、対象コンポーネントでの表示/挙動が維持されていることの確認で行う。

## Progress

- [x] (2026-01-29 08:10 JST) retired local task log にタスクを追加して着手ログを記載。
- [x] (2026-01-29 08:18 JST) 表示/ロジック混在の対象コンポーネントを列挙。
- [x] (2026-01-29 08:19 JST) 対象ごとに抽出フック案を決定。
- [x] (2026-01-29 08:22 JST) Build Progress パネル/ステップのロジックをフックに抽出し、UI を薄くする。
- [x] (2026-01-29 08:16 JST) `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。
- [x] (2026-01-29 08:16 JST) retired local task log に完了ログを記載。

## Surprises & Discoveries

- Observation: まだなし。
  Evidence: なし。

## Decision Log

- Decision: Build Progress パネルと Build Progress ステップを優先的に分離する。
  Rationale: 状態/派生/ハンドラが集中しており、UIから切り離す効果が大きいため。
  Date/Author: 2026-01-29 (Codex).

## Outcomes & Retrospective

- Outcome: Build Progress パネルと Build Progress ステップのロジックがフックに分離され、UIは描画に集中する構造になった。shape-plugin typecheck は成功した。

## Context and Orientation

対象は `plugins/shape-plugin/src/ui/components/**`。表示専用と見なせるコンポーネントは除外し、状態管理・計算・副作用が混在するコンポーネントから優先的に抽出する。フックは同一ディレクトリ配下に `use<Something>Logic.ts` などの名称で追加し、UI側はフックの戻り値だけを使う。

## Plan of Work

1) `plugins/shape-plugin/src/ui/components` 配下のコンポーネントを確認し、状態管理・計算・副作用が混在するものを列挙する。
2) 各対象について、抽出対象のロジックを定めてカスタムフックへ切り出す。
3) UI コンポーネントは props とフックの戻り値に基づく描画だけに整理する。
4) typecheck を実行し、GitHub Issue にログを残す。

## Concrete Steps

- `rg -n "useState|useEffect|useMemo|useCallback" plugins/shape-plugin/src/ui/components` で候補を把握。
- 各候補ファイルを読み、UI/ロジックの分離方針を決定。
- 新規フックファイルを作成し、既存コンポーネントからロジックを移動。
- `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` が exit 0。
- 変更したコンポーネントで UI の挙動が変わっていない。

## Idempotence and Recovery

抽出を段階的に行い、問題があれば対象コンポーネントの変更を revert する。

## Artifacts and Notes

想定ログ:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- フックは UI コンポーネントと同じフォルダに配置し、UI側はフックの戻り値のみで描画する。
- 既存の props 型は維持し、外部APIの変更は避ける。

Plan updated on 2026-01-29 to capture typecheck 完了と結果の要約。
