# Shape Preview のメタデータ集約表示と階層ホバー強調を実装する

このExecPlanは生きたドキュメントである。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective`の各セクションは作業の進行に合わせて必ず更新する。

このExecPlanは `PLANS.md`（リポジトリルート）に従って維持すること。

## Purpose / Big Picture

geoBoundaries の ADM1 由来メタデータが、島や飛地で分割されていても「同じ自治体として1行に集約」表示できるようにし、さらにマップ上のホバーや選択が「フィーチャー単体だけでなく同一自治体・同一国の範囲」まで反応する状態を作る。ユーザーはメタデータ一覧が読みやすくなり、地図上でも行政区分単位や国単位でまとめて強調表示できることを確認できる。

## Progress

- [x] (2026-01-21 08:28 JST) 既存のStep6プレビュー表示とメタデータ一覧のデータフローを整理する。
- [x] ADM1の集約表示ロジックを設計・実装し、一覧が1自治体1行になることを確認する。
- [x] フィーチャー/自治体/国の階層的ホバー・選択がマップに反映されるよう実装する。
- [x] 検証（`pnpm typecheck`）を実行し、手動確認の手順を記録する。

## Surprises & Discoveries

- Observation: `@hierarchidb/ui-map` は `dist` 型を参照しているため、型拡張後に `pnpm --filter @hierarchidb/ui-map build` が必要だった。
  Evidence: shape-plugin の typecheck が `ShapePreviewRowBase` の拡張を認識せず失敗。

## Decision Log

- Decision: 一覧行のIDを `featureId ?? id` で統一し、検索/選択/エラー集約のキーも同じIDに揃える。
  Rationale: 集約行・通常行の両方で同じキーを使うことで一覧選択とマップ強調を一致させる。
  Date/Author: 2026-01-21 / Codex
- Decision: 集約行のエラー数はメンバーの合算で表示する。
  Rationale: 行が1件でも失敗を含む場合に一覧ステータスで把握できるようにする。
  Date/Author: 2026-01-21 / Codex

## Outcomes & Retrospective

- ADM1の集約行と階層ホバー/選択の実装が完了。手動確認は未実施。

## Context and Orientation

Step6のプレビューは `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` が中核で、メタデータ一覧（`ShapePreviewList`）に渡す `featureListRows` を構築している。`featureListRows` は `ShapeFeatureMetadata`（`@hierarchidb/plugin-service-api`）から生成され、一覧表示は `packages/ui/map/src/preview/ShapePreviewList.tsx` が担う。マップのホバー状態は `packages/ui/map/src/preview/useVectorTilePreviewMapLayers.ts` が `setHoveredId` を呼び、`useShapePreviewStep.ts` 内で `setMapHoverMatches` が `MapHighlightEntry` を作ってマップに反映する。

「自治体の集約表示」は、ADM1（都道府県/州など）の同一行政区を同一行として扱うという意味で、実データのフィーチャーIDは統合しない。集約キーは国コードと行政区コード（`adminCode`）を優先し、欠けている場合は行政区名（`adminName`）を用いる。ここでいう「同一国の反応」は、同じ国コードを持つフィーチャー群がまとめて強調表示されることを指す。

## Plan of Work

まず `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` の `featureListRows` 生成を分割し、「元のフィーチャー行」と「集約行」を明確に分離する。元の行はフィーチャーID単位の情報を保持し、集約行は geoBoundaries かつ ADM1 の行を同一自治体キーでまとめる。集約行には次の情報を持たせる。

- 表示用ID（`featureId`）は `ADM1:<countryCode>:<adminCode|adminName>` 形式にする。
- `id` は集約行専用の一意キーとし、元のフィーチャーIDとは別であることを明示する。
- `memberFeatureIds`（新規フィールド）に、集約対象となったフィーチャーIDの一覧を持たせる。
- `vertexCount`/`polygonCount`/`area` は合算し、`bbox` は最小外接矩形で統合する。
- `countryName`/`countryCode`/`adminName`/`adminCode` は代表値を採用するが、空欄がない行を優先する。

次に、マップの強調表示のために「階層展開」を導入する。`useShapePreviewStep.ts` で `featureId -> {adminKey, countryKey}` のマップを作り、次の規則でIDを展開する。

- ホバー対象がフィーチャーIDの場合、そのフィーチャーIDに加え、同一自治体キーの全フィーチャーID、同一国コードの全フィーチャーIDを強調対象にする。
- 一覧で集約行（ADM1）の行を選択した場合、`memberFeatureIds` に含まれる全フィーチャーIDを強調対象にする。
- 一覧で通常のフィーチャー行を選択した場合、ホバーと同様に自治体/国の展開を行う。

展開結果は `setMapSearchMatches` / `setMapSelectedMatches` / `setMapHoverMatches` に渡すID配列として使う。`ShapePreviewList` の型定義 `ShapePreviewFeatureRow` に `memberFeatureIds?: string[]` と `aggregationLevel?: 'feature' | 'admin' | 'country'` を追加し、集約行の識別が可能になるようにする。表示専用であることを明確にするため、集約行には `aggregationLevel: 'admin'` を付与する。

## Concrete Steps

1) `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` を編集し、`featureListRows` 生成前に以下のヘルパーを追加する。

   - `buildAdminGroupKey(row): string | null`（geoBoundariesかつADM1のみ有効）
   - `aggregateFeatureRows(rows): { aggregatedRows: ShapePreviewFeatureRow[]; idToMembers: Map<string, string[]>; featureToAdminKey: Map<string, string>; countryToFeatureIds: Map<string, string[]> }`

2) `featureListRows` 生成時に `aggregateFeatureRows` を使って、集約行を挿入した配列を返す。集約行は、元のフィーチャー行を置き換える（ADM1の元行は一覧から除外）方針にする。

3) `useShapePreviewStep.ts` 内の `matchedFeatureIds` / `selectedFeatureIds` / `hoveredId` からマップハイライト用IDを組み立てる処理を追加する。集約行が選択された場合は `memberFeatureIds` を展開し、通常行が選択された場合は `featureToAdminKey` と `countryToFeatureIds` を使って階層展開する。

4) `packages/ui/map/src/preview/ShapePreviewList.tsx` の `ShapePreviewFeatureRow` 型を拡張し、集約行が持つ `memberFeatureIds` と `aggregationLevel` を受け取れるようにする。表示列は既存のまま維持し、集約行の `featureId` が識別可能であることを確認する。

5) 動作確認を行う。再生成済みの geoBoundaries ADM1 データを用意し、メタデータ一覧でADM1が1行に集約されること、一覧行を選択すると自治体/国の複数フィーチャーが強調表示されること、マップ上のホバーでも同様に強調が展開されることを確認する。

## Validation and Acceptance

- `pnpm typecheck` をリポジトリルートで実行し、exit 0 を確認する。
- Step6のプレビューで geoBoundaries ADM1 を含むデータを開き、以下を確認する。
  - 同じ自治体（島・飛地を含む）が1行に集約される。
  - 行を選択すると、その自治体内の複数フィーチャーがマップで強調表示される。
  - ホバー時に、同一国のフィーチャーも強調表示される。

## Idempotence and Recovery

集約ロジックは表示専用であり、フィーチャーIDの書き換えは行わない。修正を取り消す場合は `useShapePreviewStep.ts` の集約・展開ロジックと `ShapePreviewFeatureRow` の拡張を戻せばよい。どの変更も再適用可能で、データベースの状態を破壊しない。

## Artifacts and Notes

- 期待するログ例（確認用）
  - Map hover時に `setMapHoverMatches` に複数IDが渡っていることを DevTools で確認する。

## Interfaces and Dependencies

- `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts` は集約表示とID展開の本体。
- `packages/ui/map/src/preview/ShapePreviewList.tsx` は一覧表示用の行型を受け取る側。
- `packages/ui/map/src/preview/useVectorTilePreviewMapLayers.ts` はホバーIDの入口だが、ここは変更せず `useShapePreviewStep.ts` 側で展開する。

---

変更履歴: 2026-01-21 08:28 JST に初版作成。PLANS.md に従い、進捗と決定ログは以後更新する。
