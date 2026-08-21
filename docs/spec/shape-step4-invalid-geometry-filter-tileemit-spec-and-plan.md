# Shape Step4 Invalid Geometry Filtering: TileEmit 移設仕様と作業計画

## 1. 目的
- Step4 Config の `Invalid geometry filtering` を Source セクションから TileEmit セクションへ移設する。
- `geojson-vt` に GeoJSON を投入する直前のデータに対して invalid geometry filtering を適用する。
- invalid polygon 検出時は該当 polygon を除外し、feature 単位の error count をインクリメントする。
- タスクの実行方針は「処理継続 + warning 表示（完了とは視覚的に区別）」を採用する。
- 設定・座標・stage payload の契約違反と、明示的に有効化された品質フィルタが検出する polygon 品質問題を区別する。前者は即時失敗、後者だけを drop + warning の対象とする。

## 2. 背景
- データソース由来の生データは、運用上ある程度クリーンであることが期待できる。
- 実際の破綻ポイントは、RDP 等の簡略化や変換後に生じる自己交差・退化リングなどである。
- そのため、Source での早期判定よりも、TileEmit 直前（最終投入前）の判定が目的適合性・再現性ともに高い。

## 3. 決定事項
### 3.1 配置（UI）
- Step4 の `Source` セクションから `Invalid geometry filtering` 設定UIを削除する。
- Step4 の `TileEmit` セクションに `Invalid geometry filtering` 設定UIを配置する。
- 入力項目は `area`, `lineLength`, `maxEdgeLength`, `selfIntersection`, `triangleRingRatio` の5項目に固定する。
- `tileEmitConfig.invalidGeometryFilter` と上記5項目は正規 config で必須とし、すべて boolean とする。新規 config の既定値は全項目 `false` だが、受信済み config の欠落を runtime で `false` に補完しない。

### 3.2 実行タイミング（Worker）
- 適用タイミングは `geojson-vt` index 作成直前の GeoJSON collection とする。
- stage owner は `tileEmit` とする。Source / Geometry stage は `tileEmitConfig.invalidGeometryFilter` を参照・適用しない。
- フィルタ対象は Polygon / MultiPolygon の polygon 単位とする。
- 判定に失敗した polygon は出力対象から除外する。
- この「判定失敗」は有効化された品質チェック（area / lineLength / maxEdgeLength / selfIntersection / triangleRingRatio）への不適合を指す。非 finite 座標、WGS84 範囲外、必須 geometry/payload 欠落は入力契約違反として task を失敗させ、drop + warning に変換しない。

### 3.3 タスク結果セマンティクス
- 方針は **(2) 継続 + warning** を採用する。
- タイル出力タスクは継続し、生成可能なタイルは生成する。
- ただし invalid filtering による除外が1件以上あったタスクは `warning` として表示する。
- `warning` は挙動上は completed 系だが、UI上は completed と明確に区別する。

### 3.4 エラー計数
- 除外された polygon が属する feature の `errorCount` を加算する。
- 同一 feature 内で複数 polygon が除外された場合、feature 側の加算ルールは以下:
- `featureErrorCount += droppedPolygonCountInFeature`
- 集計として task 単位にも `droppedPolygonCount` と `affectedFeatureCount` を保持する。

## 4. ステータスモデル（warning導入）
- Task status は `status='completed'` を維持し、`TaskQueueRecord.metadata.resultSeverity='warning'` を必須付加する。`stageSnapshotUpdated` は `TaskSummary.metadata` としてこの値をUIへ渡す。
- `warning` status の新設や message prefix による推測は行わない。
- UI は `TaskSummary.metadata.resultSeverity` を明示的に検証して表示する。message や色から severity を逆算しない。
- `resultSeverity='warning'` は有効化された品質フィルタによる drop が1件以上ある場合に限る。設定/payload/座標契約違反は `status='failed'` とする。

## 5. メトリクスと表示
- Task detail に以下を表示する。
- `invalidPolygonFilteredCount`
- `invalidPolygonCheckedCount`
- `invalidPolygonFilteredRate`（`filtered/checked`）
- `affectedFeatureCount`
- `featureErrorCountTotal`
- Task list では warning アイコン/色を表示し、hover/detail で理由を確認可能にする。

### 5.1 metadata 契約
- 次の値は `TaskQueueRecord.metadata` のトップレベルへ number として保存する。
  - `invalidPolygonFilteredCount`: 品質 check によって除外した polygon 数（非負整数）
  - `invalidPolygonCheckedCount`: 1つ以上の品質 check が有効なときに検査した polygon 数（非負整数。全 check OFF なら `0`）
  - `invalidPolygonFilteredRate`: `filtered / checked`。`checked=0` なら `0`、それ以外は `0..1`
  - `affectedFeatureCount`: 1つ以上の polygon を除外した feature 数（非負整数）
  - `featureErrorCountTotal`: 影響 feature の更新後 `properties.errorCount` 合計（非負整数）
- `invalidPolygonFilteredByCheck` は5つの正規 config keyを必須キーとする非負整数 map とする。
- `invalidPolygonFilteredCount > 0` のときだけ `resultSeverity='warning'` を付与する。UI は metadata の型・範囲を検証し、message から warning を推測しない。

## 6. 実行アルゴリズム（TileEmit直前）
1. Transform 出力 GeoJSON collection を受け取る。
2. feature ごとに polygon を走査する。
3. enabled な invalid checks を適用する。
4. invalid polygon を除外し、feature error count を加算する。
5. polygon が 0 になった feature は feature 自体を除外する。
6. 集計メタデータを task に保存する。
7. フィルタ済み GeoJSON を `geojson-vt` に投入する。
8. `invalidPolygonFilteredCount > 0` の場合は warning 表示対象にする。

### 6.1 契約検証と品質 check
- 品質 check の有効/無効にかかわらず、FeatureCollection / Feature / geometry 構造、全座標の finite number、経度 `-180..180`、緯度 `-90..90`、ring の最小4座標と閉包を先に検証する。違反は throw し task failure とする。
- 品質 check は `area` → `lineLength` → `maxEdgeLength` → `selfIntersection` → `triangleRingRatio` の順で評価する。
- 複数 check に不適合な polygon は最初に不適合となった check だけを `invalidPolygonFilteredByCheck` に計上する。
- Polygon は不適合なら feature ごと除外する。MultiPolygon は不適合 polygon だけを除外し、残りが0なら feature を除外する。GeometryCollection 内の Polygon / MultiPolygon も同じ規則で再帰的に処理する。
- フィルタ後の同一 collection から `featureStats`、continent grouping、親タイル summary を再構築し、その collection をすべての geojson-vt build flow に渡す。
- 進捗 message は `Check <check label> of polygon <current> of <total>` とする（例: `Check area of polygon 3 of 99`）。

### 6.2 品質判定しきい値
- `area`: 面積 `<= 1e-8 m²`
- `lineLength`: 外周長 `<= 1e-6 m`
- `maxEdgeLength`: 最大辺長 `<= 0`、または bbox 対角距離の8倍超
- `selfIntersection`: 外周または内周の非隣接辺が交差
- `triangleRingRatio`: 外周が3頂点のとき `polygon area / bbox area < 0.015`

## 7. 互換性・移行方針
- 正規キーは `tileEmitConfig.invalidGeometryFilter` のみとする。
- `fetchConfig.invalidGeometryFilter`、`sourceConfig.invalidGeometryFilter`、旧 alias の互換読み込みは行わない。
- 旧 config は明示的な migration / cache invalidation の対象とし、runtime で正規 config と混在させない。

## 8. ロールバック方針
- 問題が出た場合は該当 PR を revert する。設定UIや worker 適用点を Source へ戻さない。
- feature flag を使用する場合は既定 OFF とし、OFF 時は filtering 自体を無効化する。旧キーの互換読み込みや契約違反の黙殺へ切り替えない。
- 品質フィルタは drop-only を維持し、元 artifact を書き換えない。

## 9. 作業計画
### 9.1 実装分割
- Phase 1: 型定義/設定キー移設
- Phase 2: Step4 UI の TileEmit への移設（i18n含む）
- Phase 3: TileEmit 直前 filtering 実装
- Phase 4: warning 表示導入（Task list/detail）
- Phase 5: 旧 config の明示的 invalidation / migration
- Phase 6: テスト追加（unit/integration）

### 9.2 依存順序
1. 型と設定スキーマ
2. worker filtering 実装
3. status/severity モデル更新
4. UI 移設と表示更新
5. テストとドキュメント更新

### 9.3 検証計画
- 型/ビルド:
- `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin --filter @hierarchidb/vt-orchestrator`
- `pnpm -w turbo run build --filter @hierarchidb/shape-plugin --filter @hierarchidb/vt-orchestrator`
- テスト:
- `pnpm -w turbo run test --filter @hierarchidb/shape-plugin -- --run`
- `pnpm -w turbo run test --filter @hierarchidb/vt-orchestrator -- --run`

### 9.4 テスト観点
- invalid polygon が除外されてもタスクは継続完了すること
- warning 表示が completed と視覚的に区別されること
- feature error count と task 集計値が一致すること
- polygon 全除外 feature の drop 処理が正しいこと
- 旧 config key が拒否され、`tileEmitConfig.invalidGeometryFilter` だけが受理されること
- 非 finite / WGS84 範囲外座標が task failure となり、warning/drop へ変換されないこと

## 10. DoD
- Step4 の Invalid geometry filtering が TileEmit セクションで設定できる。
- invalid geometry filtering が geojson-vt 直前に適用される。
- invalid polygon は除外され、feature error count が増加する。
- タスクは継続し、warning として completed と区別表示される。
- 契約違反は failed として可視化され、座標 clamp や旧 config 互換読み込みがない。
- 主要テストが追加され、対象パッケージの typecheck/test が通る。

## 11. 非採用案
- (1) 完了扱いのみ: 品質劣化が埋もれるため不採用。
- (3) 継続しつつ error: 実態（処理継続）と表示（失敗）が乖離するため不採用。
- (4) 即中止: 可用性を大きく下げるため既定動作として不採用。
