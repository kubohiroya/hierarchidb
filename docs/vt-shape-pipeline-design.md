# vt パイプライン設計（shape 固有）

本ドキュメントは、shape 固有の差分のみを記述する。
共通仕様は `docs/vt-pipeline-design.md` を参照。

## 対象ジオメトリ

- Polygon / MultiPolygon（境界を含むポリゴン群）

## UX フロー（shape）

- Step2: データソース選択
- Step3: 国/自治体レベルの選択
- Step4: ビルド設定（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Step5: ビルド
- Step6: プレビュー

## ステージ構成（shape）

- `source`
- `geometry`
- `tileEmit`

`TaskStage` は `docs/build-session-spec.md` をSSOTとする。旧文書の処理phase名との対応は次のとおり。

| canonical `TaskStage` | 旧phase名 |
| --- | --- |
| `source` | `shape-fetch` |
| `geometry` | `transform` |
| `tileEmit` | `vt` |

旧phase名は既存artifact/config/API識別子を説明する場合に限って使用し、taskQueueやbuild-session eventのstage IDには使用しない。

## source stage（shape）

- GeoJSON を国 + 自治体レベル単位で分割し取得
- smartFetch を通して取得（認証・リトライ・nodeId 超えキャッシュ）
- flatgeobuf に変換して stage1Buffers に保存
  - `domainType`: `shape`
  - `sourceKey`: `${countryCode}:${adminLevel}`（countryCode は **ISO2 を正**とし、dataSource 側で ISO2/ISO3 の揺れを吸収しない）
- `dataSource`、ISO2 `countryCode`、整数 `adminLevel`、`sourceKey`、source request signature は cache/source identity の必須要素とする。upstream revision は取得できる場合に identity へ含め、存在する空文字を欠落扱いで無視しない
- identity の欠落・空値・非 canonical 値を `unknown`、`XX`、`:0`、空 URL、node/task 情報からの推測で補完しない
- タスク単位: `countryCode + adminLevel`（1タスク=1 stage1Buffer）
- `geometry`タスク生成はplugin側が責務を持つ
  - vt-orchestratorには`geometry` / `tileEmit`タスクを投入する
  - 国コードの ISO2/ISO3 変換は plugin の dataSource strategy が担う（外部 API の国コード揺れは許容しない）
  - 内部の基準コード体系は ISO2 を採用し、`sourceKey` とキャッシュキーは ISO2 統一で運用する
  - 例: GeoBoundaries/GADM の URL は ISO3 を要求するため、strategy 側で ISO2 → ISO3 変換して URL を生成する

## geometry stage（shape）

- ズーム帯ごとに簡略化した FGB を生成
- **帯内最小zのみ tileIndex 作成**
- band3 予約は adminLevel>=2 を扱うタスクに限定
- タスク単位: `stage1Buffer` × `band`（band0/1/2、band3 は条件付き）
- band3 は「いずれかの国で adminLevel>=2 が選択された場合」に自動 ON
- 簡略化は turf の Ramer–Douglas–Peucker を使用し、許容誤差は Step4 設定に従う（入力仕様は `docs/vt-pipeline-design.md` を参照）
- Source stage が session に保存した finite `baseTolerance` と整数 `vertexLimit=6553` を必須入力とする。Geometry task 内で代表 feature の再探索や固定 tolerance へのフォールバックを行わない
- `vertexLimit=6553` は排他的な閾値であり、正常出力は feature ごとの `vertexCount < 6553` を満たす
- multiplier/minRatio/maxRatio は band ごとに finite、`0.0..2.0`、`minRatio <= multiplier <= maxRatio` を満たすことを事前検証し、clamp・並べ替え・既定値補完を行わない

## tileEmit stage（shape）

- 固定タスク（1+64+4096） + band3 予約タスク
- geojson-vt でタイル生成し VTMutationAPI へ保存
- `tileEmitConfig.invalidGeometryFilter` は5つの boolean check を持つ必須 config とし、旧 source/fetch config key を読まない
- invalid geometry filtering の stage owner は tileEmit とし、geometry artifact を GeoJSON collection に復元した後、tileEmit が使用する geojson-vt index の作成直前に一度だけ適用する
- 非 finite / WGS84 範囲外座標、必須 geometry/payload 欠落は task failure とする。明示的に有効な品質 check に不適合な polygon だけを drop + `TaskQueueRecord.metadata.resultSeverity='warning'` の対象とする

## Cache identity 契約（shape）

- source: 必須の `dataSource + sourceKey + request signature + output shaping config signature` と、存在する場合の upstream revision
- geometry: `sourceKey + bandIndex + source artifact hash + baseTolerance + geometry config signature`
- tileEmit: `bandIndex + zBase + tileId + canonical bufferIds[] + tileEmit config signature`
- 各必須文字列は空でなく、各数値は finite かつ定義された整数/範囲でなければならない。`bufferIds` は field 自体を必須とし、空配列は正規の empty-tile 判定としてのみ許容する
- 永続済み `cacheKey` / `inputHash` は両方が空でない場合だけ有効とする。一方だけの欠落、stage不明、identity構成値欠落をlegacy keyや既定値で補完しない
- `sourceKey` は正規の `ISO2:adminLevel`、source request は絶対HTTP(S) URLとして検証する。URLのrequest targetはsource `inputHash`へ含め、queryの異なるrequestを同一入力へ収束させない。upstream revisionは存在する場合に空でない値を要求する
- identity builderは文字列のtrim、数値の丸め、空配列への置換を行わない。`bufferIds` は明示された配列の各要素を検証した後にsetとしてsort/deduplicateし、field欠落と明示的な空配列を区別する
- task生成時に完全な `cacheKey` / `inputHash` pairを永続化する。resume/reconcileのreaderはtaskの正規stageとこのpairだけを読み、他のtask payloadからidentityを再構成しない
- identity契約違反はtaskのinsert/deleteより前にreconcileをrejectする。pipeline/sessionは失敗を正規error経路でUIへ可視化し、不完全なtaskや既存artifactを変更しない

## Artifact lineage / cleanup 契約（shape）

- 正規 lineage は `selection meta -> source artifact -> geometry artifact -> tileEmit artifact` とする
- 上流 artifact の削除・置換・invalid化は、参照する下流 artifactと未完了taskを下流端まで cascade cleanup する
- cleanup 完了前の artifact/cache は再利用不可とし、一部削除失敗を成功扱いしない
- cleanup failure は session/task の可視な error とし、stale artifact を残したまま次stageやresumeへ進まない

## 旧実装からの置換対象

- shape-plugin の旧 `vectortile` ステージ関連コード
- `shape-store` を `vt-shape-store` に置換
  - `shape-store` は **shape 用の旧中間ストア**を指す

## shape 固有のファイル補足

- `plugins/shape-plugin/src/services/build/shapeBuildConfig.ts`
  - Step4 の設定値から `ObsolateBuildConfig` を組み立てる（入力仕様は `docs/vt-pipeline-design.md` を参照）
- `plugins/shape-plugin/src/services/build/shapeBuildRunner.ts`
  - vt-orchestrator の `runPipeline` を呼び出す
