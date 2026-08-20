# Shape4 Geometry Tolerance 新方式仕様（Session 駆動 `baseTolerance`）

## 目的

Shape4 の Geometry ステージで使用する tolerance を、Source ステージで計算した基準値 `baseTolerance` を起点に決定する。巨大国と小国の形状複雑性差を吸収しつつ、頂点上限制約を満たすまでの再試行回数を削減する。

## 適用範囲

- 対象: Shape build pipeline（`source` → `geometry`）
- 頂点上限基準: `6553`（`SOURCE_BASE_TOLERANCE_VERTEX_LIMIT`）。正常値は `vertexCount < 6553` とし、`6553` 以上を超過として扱う
- 基準探索: `turf.simplify`（`geometrySimplify` 経由）

## 用語

- `vertexLimit`: システムの排他的な頂点閾値（正規値 `6553`）
- `maxPolygonVertexCount`: Source 出力での「1ポリゴンあたり頂点数最大値」
- `baseTolerance`: `maxPolygonVertexCount` の代表ポリゴンを `vertexLimit` 未満にする最小 tolerance。finite かつ `0..12` の必須値
- `multiplier/minRatio/maxRatio`: `baseTolerance` をズーム帯ごとに補正する係数
- `t_final`: Geometry 初回 simplify に使う tolerance

## データモデル

`sourceStageMaxima`（session record）に次を保存する。これらは Source stage が正常完了した session では必須であり、欠落・非 finite・範囲外を Geometry 側で補完しない。

- `featureMax`
- `polygonMax`
- `maxPolygonVertexCount`
- `baseTolerance`
- `vertexLimit`

型定義は以下に反映する。

- `packages/shape-api/src/shapeDbTypes.ts`
- `packages/shape-store/src/VectorTileRecord.ts`
- `packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts`

## Source ステージ仕様

1. フィルタ後 FeatureCollection から以下を集計する。
- feature 数
- polygon 数
- vertex 数
- `maxPolygonPerFeature`
- `maxPolygonVertexCount`

2. `maxPolygonVertexCount` を持つ代表ポリゴンを 1 つ選ぶ。

3. 代表ポリゴンに対し 2 分法で `baseTolerance` を求める。
- 初期: `low=0`, `high=0.1`
- `high` で未達なら倍々で拡張（上限 `12`）
- 収束条件: `high-low < 1e-7` または `maxIterations=32`

4. Source task の `metadata.fetchDetail` に下記を保存する。
- `maxPolygonVertexCount.{input,output}`
- `baseTolerance`
- `baseToleranceVertexLimit`

5. `shapePipelineSourceStage` で全 Source task を集約し、`maxPolygonVertexCount` が最大の task に対応する `baseTolerance` を session の `sourceStageMaxima` に保存する。

6. polygon が 0 件の場合は `baseTolerance=0`、`vertexLimit=6553` を明示的に保存する。`0` は「polygon が無いため simplify 不要」という正規値であり、欠落値の代用ではない。

7. 探索が規定回数または上限 `12` までに頂点上限を満たさない場合、Source task/session を失敗させる。最後の試行値や既定値を成功値として保存しない。

## Geometry ステージ仕様

1. Geometry stage 開始時に session を読み、`sourceStageMaxima.baseTolerance` と `sourceStageMaxima.vertexLimit` を取得する。`baseTolerance` は finite かつ `0..12`、`vertexLimit` は整数 `6553` でなければ契約違反として失敗する。

2. `multiplier/minRatio/maxRatio` は各 band について finite かつ `0.0..2.0` で、`minRatio <= multiplier <= maxRatio` を満たさなければならない。配列欠落、band index 欠落、順序逆転、範囲外を並べ替え・丸め・既定値補完しない。

3. task 内で代表 feature の再探索をせず、`t_final = baseTolerance * multiplier` を初回 tolerance とする。`minRatio/maxRatio` は後続の規定探索範囲を定義し、初回値を clamp する用途には使わない。

4. 初回 simplify 後に頂点上限未達の feature がある場合:
- `baseTolerance * minRatio .. baseTolerance * maxRatio` の範囲で `retrySimplifyFeatureWithinVertexLimit` を用いて規定回数内で再試行する
- 規定回数内に `6553` 未満へ収束しなければ task を失敗させる

5. `baseTolerance`、profile、band、頂点上限の欠落・不正時に、`0.1`、task 内二分探索、別 admin profile、session 値、task 値の相互補完へフォールバックしない。

## 設定値方針

`multiplier/minRatio/maxRatio` はすべて `baseTolerance=1.0` 基準の比率として扱い、範囲は `0.0..2.0` とする。

- `multiplier`: 中心値
- `minRatio`: 下限
- `maxRatio`: 上限

新規 config 作成時の正規既定値は次とする。既存/受信 config の欠落を runtime でこの値に補完してはならない。

- `multiplier=1.0`
- `minRatio=0.0`
- `maxRatio=2.0`

## 旧方式・互換方針

- 旧設定（初期値 + 増分 + 試行回数）の互換読み込みは行わない。
- 新方式を唯一の有効仕様として扱う。
- `baseTolerance` 欠落時の task 内代表 feature 探索は削除し、互換経路として残さない。

## 受け入れ基準

- Source 完了時に session へ `baseTolerance` が保存される。
- Geometry で session `baseTolerance` が必須利用される。
- `baseTolerance` / `vertexLimit` / profile 不正時は可視な contract error で停止する。
- 既存 retry 処理で頂点上限制約を満たす。
- production code に `fallbackTolerance`、profile clamp、task 内 baseTolerance 再探索が残っていない。
