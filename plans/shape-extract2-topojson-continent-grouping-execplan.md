# extract2 のTopoJSON化を大陸/国/自治体でグループ化して安定させる

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md はリポジトリ直下の `PLANS.md` を参照し、この文書はその要件に従って維持すること。

## Purpose / Big Picture

低ズームでTopoJSON化を行うときにメモリが爆発しないよう、抽出対象を大陸/国/自治体コードの階層でグループ化し、グループ単位でTopoJSON化したうえで後続のタイル生成へ渡せるようにする。これにより「隣接国の境界を共有しつつも巨大な世界単位のTopoJSONを避ける」という目的を満たす。変更後は、ズーム0の抽出で大陸単位のTopoJSON化が行われ、continent/countryNameが欠落する対象は警告ログのうえで除外される。

## Progress

- [x] (2025-12-31 01:50 JST) ExecPlan を作成し、現行の抽出/タイル生成/TopoJSONユーティリティの関係を整理する。
- [x] (2025-12-31 02:08 JST) extract2 のタスク生成を大陸/国/自治体の階層グループへ再構成し、欠落メタデータは警告して除外する。
- [x] (2025-12-31 02:08 JST) extract2 のTopoJSON化は既存の中心点タイル方式を維持しつつ、大陸グルーピングを反映する。
- [ ] 進捗とメタデータ保存の整合性を確認し、TASKS.md に結果を記録する。
- [ ] 必要なテストまたは手動確認を実行し、成功条件を記録する。

## Surprises & Discoveries

- Observation: extract1 のタスクはfeature単位に分割されており、TopoJSONの境界共有が効かない。
  Evidence: `SessionController.expandOutputsForFeatureGroups` が raw buffer を1feature単位で分割している。

## Decision Log

- Decision: ズーム0では大陸名をグループキーに含める。
  Rationale: 世界全体でTopoJSON化するよりもメモリ負荷を抑え、境界共有のメリットを残すため。
  Date/Author: 2025-12-31, Codex
- Decision: extractTopoJsonByTiles は中心点タイル方式を維持し、タイル交差方式への変更は行わない。
  Rationale: extract2 の出力は単一のFeatureCollectionであり、タイル交差で割り当てるとFeatureの重複が発生し、後段のタイル生成で重複描画が起きるため。
  Date/Author: 2025-12-31, Codex

## Outcomes & Retrospective

（完了時に記載）

## Context and Orientation

extract2 のTopoJSON化は `plugins/shape-plugin/src/services/batch/utils/topojsonExtract.ts` の `extractTopoJsonByTiles` で行われる。現在はFeatureのbbox中心点のタイルにのみ割り当ててTopoJSON化するため、広域Featureや境界共有の目的に対して不十分である。

extract2 ステージは `plugins/shape-plugin/src/services/batch/SessionController.ts` の `processExtract2Stage` が担当しており、`Extract1Task` を元に `Extract2Task` を生成する。extract2 のWorker/Local 実装は `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` と `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` にある。

メタデータの continent は `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts` でGeoBoundaries API応答から取得し、download 出力と `ShapeSourceMetadataDB` に保存される。`DownloadStageOutput` は `plugins/shape-plugin/src/services/batch/strategies/DownloadStageStrategy.ts` に定義され、download 出力から extract1/extract2 のタスクへ引き継がれる。

## Plan of Work

extract2 ステージのタスク生成を「大陸/国/自治体コード」の階層でグループ化する。具体的には、ズームレベルに0が含まれる場合、extract1 出力を continent で分割し、さらにグループが大きすぎる場合に国コード、自治体コード（featureGroupId）で分割する。continent や countryName が欠落するエントリは警告を出して除外する。

グループ化した出力は、新しい一時的なextract1バッファとして `EphemeralShapeDB.extractedBuffers` に格納し、extract2 タスクはそれを入力として処理する。各Featureには `__hdbOriginKey` を保持させ、既存の originKey 集計が壊れないようにする。

`extractTopoJsonByTiles` は中心点タイル方式のまま利用し、extract2 側のグルーピングでTopoJSON化の単位を調整する。これによりFeatureの重複を避けつつ、ズーム0のメモリ負荷を下げる。

## Concrete Steps

作業ディレクトリは `/Users/hiroya/WebstormProjects/hierarchidb` とする。

1. `plugins/shape-plugin/src/services/batch/SessionController.ts` に extract2 のグルーピング処理を追加する。
   - extract1 バッファを読み込んでFeatureをまとめる処理を新規関数として実装する。
   - continent/countryName が欠落する場合は `console.warn` で警告し、対象を除外する。
   - ズーム0の場合は continent を優先してグループを作る。グループが一定サイズを超える場合は国コード、自治体コードで分割する。
   - 各Featureに `__hdbOriginKey` を付与し、originKeyを維持する。

2. `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` と `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` で、extract2 前にFeature propertiesへ `continent`/`countryCode`/`countryName`/`featureGroupId` を補う処理を追加する。

4. `TASKS.md` の運用ログに変更内容と検証結果を記録する。

## Validation and Acceptance

- Step5 のextract2実行時に、continent/countryNameが欠落した場合に警告ログが出る。
- ズーム0でTopoJSON化が走る場合、continentごとに分割される（ログに continent を含める）。
- ベクトルタイル生成が継続でき、Step6プレビューにタイルが表示される。

可能なら `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、エラーがないことを確認する。

## Idempotence and Recovery

グループ生成は一時バッファに対して行うため、同じステップを再実行しても安全である。問題がある場合は、追加したグルーピング処理とTopoJSON分割を削除し、元の`extractTopoJsonByTiles`の中心点方式に戻す。

## Artifacts and Notes

（実装後にログや差分の要点を追記する）

## Interfaces and Dependencies

- `plugins/shape-plugin/src/services/batch/SessionController.ts`: extract2 タスク生成とバッファ統合を担当。
- `plugins/shape-plugin/src/services/batch/utils/topojsonExtract.ts`: 既存の中心点タイル方式のTopoJSON化ユーティリティ。
- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` と `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`: Feature properties への補助メタデータ付与。
- `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`: continent 取得と保存（既存）。

変更履歴: 2025-12-31 01:50 JST 作成。中心点タイル方式を維持する方針を追記。
