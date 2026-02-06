# Step6 Recycling diff build を追加する

このExecPlanは生きたドキュメントであり、`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を常に最新化する。

本リポジトリには `PLANS.md` があるため、`PLANS.md` の規約に従って本ドキュメントを維持する。参照元: `PLANS.md`。

## Purpose / Big Picture

shape の Step6（Preview）で Features の一覧から「Recycling」を選べるようにし、選択した地物だけを次回ビルドで差分的に再処理できるようにする。ユーザーは検索欄の横のボタンで対象行をまとめて切り替え、Status 列の表示から Recycling の有無を確認できる。差分ビルドが終わったら自動的に Recycling が解除されることを UI と DB の状態で確認できる。

## Progress

- [x] (2026-01-26 20:20 JST) 既存コードの調査（Step6 UI、MapPreviewFloatingTable、shapePipeline、transform handler、feature metadata schema）を実施した。
- [ ] ExecPlan に基づく UI 変更を実装する（Recycling ボタン、Status 列のアイコン、選択状態トグル）。
- [ ] Recycling 状態の永続化と更新 API を実装する。
- [ ] 差分ビルドの allowlist を pipeline に通し、transform/vt が対象のみ処理するようにする。
- [ ] 差分ビルド完了後に Recycling を自動で解除する。
- [ ] `pnpm --filter @hierarchidb/shape-plugin typecheck` などの検証を実行し、結果を記録する。

## Surprises & Discoveries

- 既存の Step6 の Status 列は `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx` が内部で生成しており、拡張には同ファイルの format を変更する必要がある。
- shape の build pipeline は `plugins/shape-plugin/src/services/vt/shapePipeline.ts` で fetch/transform/vt を常に実行するため、差分ビルド用の allowlist を渡す設計が必要になる。

## Decision Log

- Decision: Recycling 状態は `ShapeFeatureMetadata` に boolean フラグとして保存し、UI の「partial」は選択行の混在状態から計算する。
  Rationale: 部分的状態は UI の集合状態であり、DB に保存すると意味が曖昧になるため。
  Date/Author: 2026-01-26 / Codex
- Decision: 差分ビルドの allowlist は transform handler に渡し、デコード後の FeatureCollection をフィルタする。
  Rationale: 既存の pipeline に最小限の侵入で差分処理を挿入できるため。
  Date/Author: 2026-01-26 / Codex

## Outcomes & Retrospective

（実装後に記入）

## Context and Orientation

Step6 の Features 一覧は `packages/ui/map/src/preview/ShapePreviewList.tsx` が `FloatingWindow` と `MapPreviewFloatingTable` を組み合わせて描画している。検索欄・三点リーダー（列設定）は `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx` に実装されている。shape の Feature Metadata は `packages/plugin-service-api/src/types/shapeBuildTypes.ts` の `ShapeFeatureMetadata` で定義され、永続化は `@hierarchidb/shape-store` の `featureMetadata` テーブルに保存される。ビルドの fetch/transform/vt は `plugins/shape-plugin/src/services/vt/shapePipeline.ts` が組み立て、transform の実処理は `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` が行う。

「Recycling」は本タスクで追加する feature 単位の差分ビルド指定を指す。UI 上は Feature 行に紐づくフラグで、選択行のトグル操作により on/off を切り替える。差分ビルドでは `recycling` が on の feature のみを対象に transform/vt を実行し、完了後にフラグを off に戻す。

## Plan of Work

まず、UI の検索欄と列設定ボタンの間に追加ボタンを置けるように `MapPreviewFloatingTable` に拡張ポイントを追加する。`MapPreviewFloatingTableProps` に `toolbarActions?: React.ReactNode` と `statusAdornment?: (row: Row) => React.ReactNode` を追加し、検索バーの右側に `toolbarActions` を挟む。Status 列の format では `Chip` と `statusAdornment(row)` を並べて表示し、Recycling アイコンが既存の Status 表示の右側に並ぶようにする。

次に、`ShapePreviewList` に Recycling ボタンと状態表示を組み込む。`ShapePreviewListProps` に `onToggleRecycling?: () => void` と `recyclingSelectionState?: 'none' | 'all' | 'partial'`（または同等の表現）を追加し、`toolbarActions` で `Recycling` アイコンボタンを生成する。選択行がない場合は disabled、混在時は `partial` とみなして「オンに統一」する。Status 列には `row.recycling` が true の場合に `Recycling` アイコンを表示する。

UI の状態更新は `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` で行う。ここで `shapeMutationAPIImpl` をインポートし、`featureMetadataRows` と `selectedFeatureIds` から対象行の現在状態を集計し、次の状態（partial→on、on→off、off→on）を決めて `putFeatureMetadata` で更新する。`ShapePreviewFeatureRow` に `recycling?: boolean` を追加し、`featureMetadataRows` からこの値を伝搬する。

次に、`ShapeFeatureMetadata` に `recycling?: boolean` を追加し、`buildFetchFeatureCollection` / `buildFetchFeatureMetadata` などで `properties.__hdbFeatureId` を付与できるようにする。transform handler から allowlist の一致判定ができるように、fetch stage で `__hdbFeatureId` を必ず設定する。既存キャッシュに `__hdbFeatureId` が無い場合は diff build をフル処理にフォールバックする方針を取る（具体的な判定は Decision Log で更新する）。

差分ビルドは `runShapePipeline` の開始時に `shapeQueryAPIImpl.listFeatureMetadata(nodeId)` を読み、`recycling === true` の `featureId` を allowlist にする。allowlist が空なら通常ビルド。allowlist がある場合は `createTransformByBandHandler` の context に `featureIdAllowlist` を渡し、transform handler の decode 後に FeatureCollection をフィルタする。フィルタ後に空ならタスクを `skipped` 扱いにするか、progress 100 の完了扱いにしてログを残す。必要なら task status の扱いを決定し、`Surprises & Discoveries` に記録する。

ビルド完了後は `recycling` が true の行を `false` に戻す。`buildFeatureMetadataFromTransformCaches` に既存の metadata を渡して `recycling` を引き継ぎつつ、allowlist の行だけ `false` にするか、pipeline 終了時に `shapeMutationAPIImpl.putFeatureMetadata` で該当行のみ更新する。後者の方が diff build の対象だけ確実に解除できるため、実装時に選択する。

## Concrete Steps

1) UI 拡張ポイントの追加。
   - 編集: `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`
   - `MapPreviewFloatingTableProps` に `toolbarActions` と `statusAdornment` を追加。
   - 検索バーの右側に `toolbarActions` を挟む。
   - Status 列 format を `Chip + statusAdornment(row)` で描画する。

2) Recycling ボタンと状態表示。
   - 編集: `packages/ui/map/src/preview/ShapePreviewList.tsx`
   - `ShapePreviewListProps` に Recycling トグル用の props を追加。
   - `toolbarActions` に `Recycling` アイコンボタンを置く。
   - Status 列の statusAdornment に Recycling アイコンを表示する。

3) UI 状態更新ロジック。
   - 編集: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
   - `shapeMutationAPIImpl` をインポートし、選択行の `recycling` を更新する handler を追加。
   - `ShapePreviewFeatureRow` に `recycling` を追加し、metadata から伝搬。

4) metadata schema 変更。
   - 編集: `packages/plugin-service-api/src/types/shapeBuildTypes.ts` の `ShapeFeatureMetadata` に `recycling?: boolean` を追加。
   - 影響を受ける型 alias（`packages//src/tilesDb.ts` など）も更新。

5) fetch/transform の allowlist 対応。
   - 編集: `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` に `__hdbFeatureId` 付与。
   - 編集: `packages/vt-orchestrator/src/contexts.ts` に `featureIdAllowlist?: Set<string>` を追加。
   - 編集: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` で decode 後に allowlist フィルタを追加。
   - 編集: `plugins/shape-plugin/src/services/vt/shapePipeline.ts` で allowlist を取得し context に渡す。

6) Recycling の自動解除。
   - 編集: `plugins/shape-plugin/src/services/vt/shapePipeline.ts` でビルド完了時に `recycling` を false に更新。

## Validation and Acceptance

- `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、exit 0 を確認する。
- Step6 の Features FloatingWindow を開き、検索欄と列設定ボタンの間に Recycling アイコンがあることを確認する。
- 任意の行を選択して Recycling ボタンを押し、Status 列に Recycling アイコンが出ることを確認する。
- Recycling がオンの行がある状態でビルドを開始し、完了後に Recycling 表示が消えていることを確認する。

## Idempotence and Recovery

変更は再実行可能であり、DB の既存データは `recycling` の追加フィールドだけが影響する。問題がある場合は該当差分を revert し、`ShapeFeatureMetadata` の追加フィールドを削除すれば元に戻る。

## Artifacts and Notes

実装中に `skipped` のタスク扱いが必要になった場合は、その挙動とログを `Surprises & Discoveries` に記録する。

## Interfaces and Dependencies

- `ShapeFeatureMetadata` に `recycling?: boolean` を追加する。
- `MapPreviewFloatingTable` に `toolbarActions?: React.ReactNode` と `statusAdornment?: (row: Row) => React.ReactNode` を追加する。
- `TransformByBandStageContext` に `featureIdAllowlist?: Set<string>` を追加する。

更新履歴: 2026-01-26 20:30 JST 初版作成。
