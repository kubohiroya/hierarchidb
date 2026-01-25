# TanStack Table ベースの新グリッド設計と段階移行

このExecPlanは生きた文書である。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective`の各セクションを作業に合わせて必ず更新する。

このExecPlanはリポジトリ直下の`PLANS.md`に従って作成されている。作業中は`PLANS.md`の要件に従って本書を更新すること。

## Purpose / Big Picture

大量行の仮想化、列の可視性切替、列リサイズと永続化、列ソートと永続化、インライン編集、行選択、グルーピング、検索による絞り込み表示を、1つのテーブル基盤で一貫して扱えるようにする。利用者はshapeのStep6 Featuresと/mapの該当画面で、ADM0/ADM1/ADM2（ADM3+）単位のグルーピングや列設定が再訪時に復元されることを確認できる。

## Progress

- [x] (2026-01-25 18:24 JST) ExecPlan作成に着手し、要件と永続化方針を整理した。
- [x] (2026-01-25 18:41 JST) 新グリッドのAPIと内部状態（列可視性/列幅/ソート/グルーピング/フィルタ/選択/編集）の設計を確定した。
- [x] (2026-01-25 18:41 JST) TanStack Table + Virtualの新グリッドとlocalStorage永続化ヘルパーを`packages/ui/data-grid`へ追加した。
- [x] (2026-01-25 18:41 JST) shape Step6と/mapのshape一覧で新グリッドへ置換し、ADMグルーピング設定を追加した（検証は未実施）。
- [ ] 既存GenericDataGridの残存利用箇所の移行計画を確定し、必要に応じて移行または段階移行の方針を記録する。
- [ ] 仕様と検証結果を`Outcomes & Retrospective`にまとめ、ExecPlanを完了状態に更新する。

## Surprises & Discoveries

- まだ記載なし。

## Decision Log

- Decision: 永続化ストレージはlocalStorageとし、保存キーは画面単位（nodeTypeを含め、nodeIdは含めない）で分離する。
  Rationale: 画面ごとの設定復元が目的であり、ノードごとの細分化は不要というユーザー要件に一致するため。
  Date/Author: 2026-01-25 / Codex

- Decision: adminLevelが3以上のグループは`ADM3+`としてまとめる。
  Rationale: 主要な表示はADM0/1/2であり、細分が増えても視認性を損なわないまとめ方が必要なため。
  Date/Author: 2026-01-25 / Codex

- Decision: 永続化は`MapPreviewFloatingTable`でstateを保持し、TanStack Table側は状態適用と更新通知に専念させる。
  Rationale: 画面単位のキー設計と既存のカラム選択UIを維持しつつ、永続化範囲を明示的に管理するため。
  Date/Author: 2026-01-25 / Codex

## Outcomes & Retrospective

未着手。

## Context and Orientation

現在の`GenericDataGrid`は`packages/ui/data-grid/src/GenericDataGrid.tsx`でMUI Tableを使っており、仮想化は`@tanstack/react-virtual`の`useVirtualizer`のみを利用している。列リサイズや列可視性、グルーピングなどの高度な機能は自前で拡張する必要がある。shape Step6のFeaturesフローティングウィンドウは`packages/ui/map/src/preview/ShapePreviewList.tsx`から`packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`を経由して`GenericDataGrid`を描画している。/map画面では`app/src/router/routes/modeless/modelessDialogContent.tsx`内で`GenericDataGrid`が利用される。新しいグリッドはTanStack Tableを実装として用い、仮想化は`@tanstack/react-virtual`を併用する。

## Plan of Work

まず`packages/ui/data-grid`にTanStack Tableベースの新コンポーネント（仮称`TanstackDataGrid`）を追加する。機能要件は、仮想化、列可視性切替、列リサイズ、列リサイズの永続化、列ソートの永続化、インライン編集、行選択、グルーピング、検索フィルタである。永続化はlocalStorageにJSON文字列として保存し、画面単位のキーを用いる。キーは`hierarchidb:grid:<screen>:<gridId>:<state>`の階層構造とし、`<screen>`に`/map`や`shape:step6`のような画面ID、`<gridId>`に`features`などの論理名、`<state>`に`columns`/`columnSizing`/`sorting`/`grouping`/`visibility`/`filters`などの状態名を使う。nodeTypeは`shape`のように`<screen>`に含め、nodeIdは含めない。

次にshape Step6のFeatures表示で`MapPreviewFloatingTable`が新グリッドを使うように置換する。ここでは`adminLevel`の列でグルーピングを有効にし、表示ラベルは`ADM0`/`ADM1`/`ADM2`/`ADM3+`に正規化する。/map画面では`app/src/router/routes/modeless/modelessDialogContent.tsx`のテーブルが対象となるため、同様のグルーピングを行う列が存在する場合にのみ有効化する。列名が異なる場合は`adminLevel`に相当する列を明示的にマッピングする。最後に、既存の`GenericDataGrid`利用箇所を洗い出し、段階移行か全面移行かを決めて計画に反映する。

## Concrete Steps

作業ディレクトリは`/Users/hiroya/WebstormProjects/hierarchidb`とする。

1. 新グリッドコンポーネントと状態永続化ヘルパーを`packages/ui/data-grid`に追加する。
   - 追加ファイル: `packages/ui/data-grid/src/TanstackDataGrid.tsx`（仮名）
   - 追加ファイル: `packages/ui/data-grid/src/storage/gridStateStorage.ts`（localStorage入出力）
   - 既存の`packages/ui/data-grid/src/index.ts`にエクスポートを追加する。

2. TanStack Tableの状態管理を実装する。
   - 列可視性: `columnVisibility` state
   - 列幅: `columnSizing` state
   - ソート: `sorting` state
   - フィルタ: `globalFilter`/`columnFilters` state
   - グルーピング: `grouping` state
   - 行選択: `rowSelection` state
   - 編集: セル編集コールバックと編集UI（入力中状態の管理）

3. 永続化キーを実装する。
   - 例: `hierarchidb:grid:shape:step6:features:columnSizing`
   - 例: `hierarchidb:grid:/map:modeless:columnVisibility`
   - 保存内容はJSON文字列で、各stateの型と互換であることを明記する。

4. shape Step6のFeatures表を新グリッドに置換する。
   - 対象ファイル: `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`
   - `ShapePreviewList`の挙動（検索、選択、エラー表示）は維持しつつ、表自体を新グリッドへ差し替える。
   - グルーピングは`adminLevel`列で有効化し、ラベル整形関数を追加する。

5. /map画面の表で新グリッドに置換する。
   - 対象ファイル: `app/src/router/routes/modeless/modelessDialogContent.tsx`
   - `adminLevel`に相当する列があればグルーピングを有効化する。

6. 既存GenericDataGridの利用箇所を確認し、移行の優先度と残存可否をExecPlanに記録する。

## Validation and Acceptance

最低限の検証として、次のコマンドを実行し型エラーがないことを確認する。
  - `pnpm --filter @hierarchidb/ui-grid typecheck`
  - `pnpm --filter @hierarchidb/ui-map typecheck`
  - `pnpm --filter @hierarchidb/app typecheck`

手動検証として、アプリを起動して以下を確認する。
  - shape Step6のFeatures表でグルーピングが`ADM0/ADM1/ADM2/ADM3+`で表示され、行の展開・折りたたみができる。
  - 列可視性、列幅、ソート状態が画面再表示後に復元される。
  - /map画面の該当表でも同様に列状態が復元される。

## Idempotence and Recovery

localStorageへの保存は同じキーに上書きするため、繰り返し実行しても安全である。問題が発生した場合は保存キーの値を削除するか、機能差分をrevertして元の`GenericDataGrid`へ戻せるようにする。

## Artifacts and Notes

期待されるlocalStorageの保存例（JSON文字列）:
  hierarchidb:grid:shape:step6:features:columnSizing = {"featureId":220,"countryName":180,"adminLevel":120}
  hierarchidb:grid:shape:step6:features:sorting = [{"id":"adminLevel","desc":false}]
  hierarchidb:grid:shape:step6:features:grouping = ["adminLevel"]

## Interfaces and Dependencies

依存ライブラリは`@tanstack/react-table`（テーブル状態と行モデル）と`@tanstack/react-virtual`（仮想化）を使用する。既存のMUI Tableの見た目を維持しつつ、TanStack Tableから得られる行モデルを描画に使う。永続化はlocalStorageへのJSON文字列保存とし、保存/復元に失敗してもUIが壊れないようにtry/catchで握りつぶす。

本書は作業に合わせて更新する。変更時は必ず`Decision Log`と`Progress`へ反映する。

更新メモ: 実装着手に合わせて進捗と設計判断を追記した。
