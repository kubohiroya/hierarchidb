# Shape tile preprocessing with per-tile indexing

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is located at `PLANS.md` in the repository root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

この変更により、タイル生成が「世界全体の巨大な FeatureCollection を 1 度に処理する」方式ではなく、「タイル座標ごとに分割されたフィーチャー集合を参照してタイルを生成する」方式になります。さらに、ビルドの識別子は `sessionId` ではなく `nodeId` に統一し、Shape ノード削除時に中間/最終成果物が `nodeId` で連動削除できる状態にします。ユーザーは Step5 のビルドで `Invalid string length` が発生しにくくなり、タイル生成の処理が安定して進むこと、そして `nodeId` ベースでの削除連動が動くことを確認できます。

## Progress

- [x] (2025-12-29 03:35 JST) ExecPlan を新規作成し、目的と変更方針を明文化した。
- [x] (2025-12-29 04:20 JST) タイル前処理の索引化設計と DB スキーマの決定、実装手順を具体化した。
- [x] (2025-12-29 04:55 JST) タイル前処理の実装と vectortile 生成経路の差し替えを完了した。
- [x] (2025-12-29 04:55 JST) sessionId を廃止し、nodeId を唯一の識別子として扱う形に移行した。
- [ ] (2025-12-29 03:35 JST) 手動ビルドと typecheck を実行し、ログと結果を運用ログへ記録する。

## Surprises & Discoveries

- Observation: まだ記録なし。

## Decision Log

- Decision: タイル前処理の成果物は `ShapeTileMetadataDB.tiles` に保存し、vectortile 生成側は `stage-tile:` プレフィックスの inputBufferId で参照できるようにする。
  Rationale: 既存の Dexie テーブルがタイル座標キーを持っており、追加テーブルを増やさずに「タイル座標→データ」を保存できる。runtime-worker 側でプレフィックス判定を追加すれば、タイル単位入力に切り替えられる。
  Date/Author: 2025-12-29 / Codex
- Decision: メタデータ生成はタイル前処理で「省略前」に実施し、`ShapeTileMetadataDB.featureMetadata` に保存する。
  Rationale: 簡略化後の省略を許容した後では国/自治体メタデータが欠落するため、確定前に保存しておく必要がある。
  Date/Author: 2025-12-29 / Codex
- Decision: `sessionId` は廃止し、Shape ノードの識別子として `nodeId` を唯一のキーとして扱う。既存の `sessionId` フィールドが残る箇所は、値を `nodeId` に固定する。
  Rationale: セッション識別が別物になると再開が壊れるため、ビルド識別と削除連動を `nodeId` に統一する必要がある。
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

- (TBD) 実装完了後に、Invalid string length が再発しないことと、タイル単位処理が確認できることをまとめる。

## Context and Orientation

現在の vector tile 生成は、`plugins/shape-plugin/src/services/batch/SessionController.ts` の `buildVectorTileInputBuffer()` が「全簡略化フィーチャーを 1 つの FeatureCollection に合成」し、`RuntimeWorkerVectorTileAdapter` が `persistGeoJsonInput()` で JSON 化したバッファを Dexie に保存したうえで runtime-worker の `generateTiles()` を呼び出しています。runtime-worker 側の `packages/runtime-worker/src/services/StageProcessingService.ts` は `generateVectorTilesFromJsonBuffer()` を呼び、入力バッファを 1 つ読み込んでタイル群を生成します。これらは `sessionId` を前提にしていますが、今後は `nodeId` を唯一の識別子として扱い、`sessionId` を別物として扱わないようにします。

ここで「タイル前処理」とは、簡略化済みフィーチャーをタイル座標ごとに分割し、タイル座標をキーに Dexie に保存する処理を指します。「タイル生成」は、タイル座標をキーに保存されたフィーチャー集合を読み出して 1 枚のベクトルタイルを生成する処理を指します。「タイル座標」は z/x/y のタイル番号です。

既存の Dexie テーブル `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts` は `tiles` テーブルを持ち、`sessionId + z + x + y` で検索できる構成です。ここをタイル前処理の成果物として使います。`sessionId` の値は `nodeId` と同一に固定し、入力タイルは `input:${nodeId}` として別系統に保存します。

## Plan of Work

最初に、タイル前処理の成果物の保存形式を定義します。`ShapeTileMetadataDB.tiles` に、タイル座標ごとの FeatureCollection（JSON 文字列の ArrayBuffer）を保存します。キーは `stageTileKey = input:${nodeId}-${z}-${x}-${y}` とし、`contentType` は `application/json` とします。`sessionId` フィールドには `input:${nodeId}` を保存し、同じテーブル内で入力タイルと出力タイルを区別できるようにします。サイズも保存し、後続の警告表示に使います。

次に、`SessionController` の extract2 ステージ完了後にタイル前処理を追加します。簡略化済みフィーチャー（`EphemeralShapeDB.extractedBuffers`）を読み取り、各フィーチャーの bbox から z/x/y を計算し、タイルごとの FeatureCollection を構築して `ShapeTileMetadataDB.tiles` に保存します。ここでの「分割」は「同一フィーチャーが複数タイルに属するなら各タイルに同じフィーチャーを重複保存する」方式とします。重複はストレージ増加と引き換えに検索を簡単にするためで、ユーザーの要件（タイル座標キーで検索）に合致します。

タイル生成ステージでは、`ShapeTileMetadataDB.tiles` を `input:${nodeId}` で検索して z/x/y の一覧を作り、そのタイル一覧から vectortile タスクを作成します。タスクの `inputBufferId` には `stage-tile:input:${nodeId}-${z}-${x}-${y}` を設定し、`RuntimeWorkerVectorTileAdapter` は `persistGeoJsonInput()` を呼ばずに `generateTiles()` を直接実行します。

メタデータ生成は「簡略化により国や自治体が省略されることを許容」する前に行う必要があるため、タイル生成ステージではなくタイル前処理ステージで実施します。具体的には、簡略化済みフィーチャーをタイル座標へ分割する直前に、国コード・行政レベル・行政名などのメタデータを `ShapeTileMetadataDB.featureMetadata` に保存し、その後にフィルタ条件で省略が起きてもメタデータは残る構成にします。

runtime-worker 側の `RealVectorTileWorker.readBuffer()` に `stage-tile:` プレフィックス判定を追加し、該当する場合は `TilesDB` の `tiles` テーブルからデータを取得します。通常の `inputBufferId` は従来どおり `EphemeralGisDB` を参照します。

最後に、`Invalid string length` 対策として追加した「入力バイト数チェック」は、タイル前処理で作成したタイル単位の JSON サイズに対して適用します。サイズが閾値を超える場合は `SessionController.requestPause()` を呼び、警告メッセージを UI に通知して処理を一時停止します。警告メッセージには「タイル座標とサイズ」を含め、どのタイルが原因か分かるようにします。

## Concrete Steps

1) タイル前処理の保存形式とメタデータ生成を実装する。
   - 編集: `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts`
   - 編集: `plugins/shape-plugin/src/services/batch/SessionController.ts` に `buildTileFeatureIndex()` を追加し、extract2 完了後に呼び出す。
   - 目標: `ShapeTileMetadataDB.featureMetadata` に省略前のメタデータを保存し、`ShapeTileMetadataDB.tiles` に `input:${nodeId}-${z}-${x}-${y}` をキーとして JSON バッファを保存できる。

2) vectortile タスクをタイル単位にする。
   - 編集: `plugins/shape-plugin/src/services/batch/SessionController.ts` の `buildVectorTileTasks()` を、`ShapeTileMetadataDB.tiles` からタイル一覧を作る方式に変更する。
   - 目標: `inputBufferId` が `stage-tile:input:${nodeId}-${z}-${x}-${y}` になる。

3) runtime-worker が tile key を読み出せるようにする。
   - 編集: `packages/runtime-worker/src/services/StageProcessingService.ts` の `RealVectorTileWorker.readBuffer()` に `stage-tile:` 判定を追加する。
   - 目標: `TilesDB.tiles` から JSON バッファを取得し、`generateVectorTilesFromJsonBuffer()` に渡せる。

4) サイズ警告で一時停止する。
   - 編集: `plugins/shape-plugin/src/services/batch/SessionController.ts` でタイル前処理時のサイズ判定を行い、閾値超過で `requestPause()` を呼ぶ。
   - 目標: Step5 の UI に warning が出てステージが paused になる。

コマンド例は以下。作業ディレクトリは `cwd=/Users/hiroya/WebstormProjects/hierarchidb`。

  pnpm --filter @hierarchidb/shape-plugin typecheck

期待される出力例:

  > @hierarchidb/shape-plugin typecheck
  > tsc --noEmit
  (エラーなし)

## Validation and Acceptance

手動確認として、shape の Step5 でビルドを実行し、以下を観察する。

- タイル前処理後、`ShapeTileMetadataDB.tiles` にタイル座標キーが保存されている。
- タイル生成がタイル単位で進行し、`Invalid string length` が発生しない。
- 入力サイズが閾値を超えるタイルがある場合、ビルドが paused になり、警告が UI に表示される。

テストとしては `pnpm --filter @hierarchidb/shape-plugin typecheck` を実行し、エラーが出ないことを確認する。

## Idempotence and Recovery

タイル前処理は `nodeId` をキーに保存するため、同じノードで再実行すると上書き更新される。安全なやり直しが可能である。ロールバックは、`ShapeTileMetadataDB` と `SessionController`、`StageProcessingService` の変更を revert し、`TASKS.md` の運用ログ追記を削除する。

## Artifacts and Notes

想定ログ例（進捗ログまたは console）：

  [Session <id>] Tile preprocessing stored: z=5 x=28 y=12 size=1.8MB
  [Session <id>] Vector tile stage processing: 256 tiles

## Interfaces and Dependencies

- `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts` の `tiles` テーブルをタイル前処理の保存先とし、`featureMetadata` を省略前メタデータの保存先とする。
- `plugins/shape-plugin/src/services/batch/SessionController.ts` に「タイル前処理の実装」「タイル単位のタスク生成」「サイズ警告で pause」を追加する。
- `packages/runtime-worker/src/services/StageProcessingService.ts` の `RealVectorTileWorker.readBuffer()` が `stage-tile:` プレフィックスを解釈できるようにする。
- `@hierarchidb/gis-sdk` の `generateVectorTilesFromJsonBuffer()` を引き続き利用し、タイル単位の JSON バッファを入力として渡す。

Plan revision note: `sessionId` を廃止して `nodeId` に統一する方針と、入力タイルのキー/検索条件を `input:${nodeId}` に変更する方針を追記した。
Plan revision note: 実装完了に合わせて Progress の該当項目を完了扱いに更新した。
