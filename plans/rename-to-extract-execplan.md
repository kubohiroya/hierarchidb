# simplify → extract の全面リネーム（破壊的）

この ExecPlan は生きた文書です。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業の進行に合わせて必ず更新します。

リポジトリ直下の `PLANS.md` に従ってこの ExecPlan を維持します。

## Purpose / Big Picture

本変更により、UI とコード全体で「簡略化(simplify)」という用語を「抽出(extract)」に統一する。利用者は「捨てる側」ではなく「残す側」を意識できる表現になり、Step4/Step5 の設定や進捗、ログの読み取りが直感的になる。動作の中身は現状維持で、名称と API のみが破壊的に置き換わる。確認方法は、Step4/Step5/Step6 の画面とログで simplify 表記が残っていないこと、extract1/extract2 の新名称でステージが動くことを目視する。

## Progress

- [x] (2025-12-30 14:15 JST) ExecPlan を作成し、目的/方針/スコープを明文化した。
- [x] (2025-12-30 14:20 JST) monorepo 全体の simplify 参照を棚卸しし、置換対象を整理した（rg で 640 行ヒット）。
- [x] (2025-12-30 14:35 JST) simplify/simplification の一括置換を実施し、主要ファイルのリネームを開始した。
- [x] (2025-12-30 14:55 JST) topojson-simplify/turf.simplify/GeoBoundaries/OSRM など外部語彙の例外処理を追加した。
- [ ] UI/I18N/ログ/コード/ファイル名の rename を一貫して完了する（残存箇所の洗い出しと修正）。
- [ ] 破壊的変更に伴う旧データ破棄手順を追加し、動作確認を記録する。
- [ ] 代表検証（typecheck/lint/test と手動確認）を実行し結果を記録する。

## Surprises & Discoveries

- Observation: monorepo 全体で simplify/simplification/simplify1/2 の参照が広範囲に存在し、ファイル名の移動と import 更新が大きな変更になる。
  Evidence: rg で 640 行のヒットを確認。

- Observation: 外部 API/依存の語彙（topojson-simplify、turf.simplify、GeoBoundaries の simplifiedGeometryGeoJSON、OSRM overview の simplified）は変更できない。
  Evidence: 置換後に topojson-extract など無効な依存名が発生したため、外部語彙のみ復旧。

## Decision Log

- Decision: simplify 表記は monorepo 全体で extract に全面置換し、API 名/型名/ファイル名も例外なく更新する。
  Rationale: 部分的な名称変更では利用者体験の不一致が残るため。破壊的変更が許容される前提のため全置換を採用した。
  Date/Author: 2025-12-30, Codex

- Decision: 外部 API/依存の語彙（topojson-simplify、turf.simplify、GeoBoundaries の simplifiedGeometryGeoJSON、OSRM overview の simplified）は保持する。
  Rationale: 外部プロトコル/ライブラリの識別子は変更できず、破壊的変更の許容範囲を超えるため。内部表現では抽出語彙に統一し、外部キーは明示的にマッピングする。
  Date/Author: 2025-12-30, Codex

## Outcomes & Retrospective

完了時に、変更によって実際に「抽出」表記に統一されたこと、影響範囲、残課題をここにまとめる。

## Context and Orientation

本リポジトリは monorepo で、UI は `app/` と `plugins/*/src/ui` にあり、共通 UI/型は `packages/` 以下にある。`shape-plugin` を含む複数プラグインが「simplify1/2」というステージ名、設定項目、ログ文言を持つ。`simplify` という用語は UI 文言、I18N、ログ、TypeScript の型名、関数名、クラス名、ファイル名に広く分布している。本変更では「simplify/simplification」を「extract/extraction」に統一し、ステージ名は `simplify1/2` から `extract1/2` に変える。`extract` は「残す対象を抽出する」という意味であり、ここでは「フィルタ/許容値に基づいて残す形状を決定し、後工程へ渡す」処理を指す。破壊的変更のため、既存の DB やキャッシュに残る旧ステージ名のデータは読み込まない方針とする。

## Plan of Work

最初に `rg` で monorepo 全体の `simplify` / `simplification` / `simplify1` / `simplify2` を棚卸しし、UI 文言とコードの置換対象を分けて整理する。次に I18N 文言を「簡略化 → 抽出」「簡略化許容値 → 抽出許容値」のように一括置換し、UI 表示が更新されることを確認する。コード側ではステージ名、タスク型、設定型、関数名、クラス名、ファイル名を `extract` 系に変更する。文字列リテラルの `simplify1/2` を `extract1/2` に統一し、DB レコードの `taskType` や `stage` を新名称に変更する。旧データは互換維持しないため、必要なら削除手順（DB/キャッシュの削除）を README もしくは運用ログに明記する。最後に `rg` で simplify 表記が残っていないことを確認し、typecheck/lint/test を実行して整合を確かめる。

## Concrete Steps

作業はリポジトリルート `/Users/hiroya/WebstormProjects/hierarchidb` で行う。まず `rg -n "simplify|simplification|simplify1|simplify2"` を実行し、ファイル別に対象を一覧化する。次に rename を段階的に行う。ファイル名変更は `mv` で行い、TypeScript の import 参照を必ず更新する。UI 文言の置換後は、`rg -n "簡略化|simplify"` を実行して残存箇所を洗い出す。ステージ名の変更後は、`rg -n "simplify1|simplify2"` で残存箇所が 0 になることを確認する。変更後に `pnpm lint && pnpm format && pnpm typecheck && pnpm test` を実行し、結果を運用ログに記録する。

## Validation and Acceptance

UI での確認は Step4/Step5/Step6 を開き、設定ラベルと進捗表示が「抽出」表記に変わっていることを目視する。ログに `simplify` が出ないことを確認する。ビルドでは `extract1/2` ステージが実行されることを確認する。テストは `pnpm lint && pnpm format && pnpm typecheck && pnpm test` を実行し、成功ログを保存する。破壊的変更に伴い旧 DB が残る場合は削除手順を示し、削除後に UI の表示が正常であることを確認する。

## Idempotence and Recovery

置換は繰り返し実行しても差分が増えないようにする。rename 後にビルドが壊れた場合は、`git diff` で変更範囲を確認し、対象ファイルの rename を段階的に戻す。旧データが原因で動作確認が阻害される場合は、該当の IndexedDB/キャッシュを削除して再試行する。

## Artifacts and Notes

作業中に得られた `rg` の結果やエラーはここに短い抜粋として残す。

  - rg -n "simplify|simplification|simplify1|simplify2" app packages plugins -g"*.ts" -g"*.tsx" -g"*.md" -g"*.json"
    - 640 行ヒット

## Interfaces and Dependencies

対象は monorepo 全体で、`packages/`, `plugins/`, `app/` 配下にまたがる。TypeScript の型名・インターフェース名・enum/文字列リテラルに `simplify` が含まれる場合は `extract` 系に置き換える。ステージ名は `simplify1/2` から `extract1/2` に変更し、タスク型や DB の `taskType`/`stage` の値も同じ名称に揃える。I18N は `plugins/*/src/ui/locales/*.json` と `packages/ui/**/locales` を対象にし、UI の文言を抽出に統一する。Map や Worker の通信で `simplify` をキーにしている箇所は全て `extract` に変更する。

Plan update note (2025-12-30 14:20 JST): 参照棚卸しの進捗とヒット数を Progress/Surprises/Artifacts に反映した。
Plan update note (2025-12-30 14:55 JST): 語彙置換後に外部 API/依存の例外を明示し、Decision Log に記録した。
