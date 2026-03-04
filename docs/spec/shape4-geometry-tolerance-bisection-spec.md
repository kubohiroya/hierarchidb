# Shape4 Geometry Tolerance 新方式仕様（Session 駆動 `t_base`）

## 目的

Shape4 の Geometry ステージで使用する tolerance を、Source ステージで計算した基準値 `t_base` を起点に決定する。巨大国と小国の形状複雑性差を吸収しつつ、頂点上限制約を満たすまでの再試行回数を削減する。

## 適用範囲

- 対象: Shape build pipeline（`source` → `geometry`）
- 頂点上限基準: `6553`（`SOURCE_BASE_TOLERANCE_VERTEX_LIMIT`）
- 基準探索: `turf.simplify`（`geometrySimplify` 経由）

## 用語

- `vertexLimit`: システム上限頂点数（既定 `6553`）
- `maxPolygonVertexCount`: Source 出力での「1ポリゴンあたり頂点数最大値」
- `t_base`: `maxPolygonVertexCount` の代表ポリゴンを `vertexLimit` 以下にする最小 tolerance
- `multiplier/minRatio/maxRatio`: `t_base` をズーム帯ごとに補正する係数
- `t_final`: Geometry 初回 simplify に使う tolerance

## データモデル

`sourceStageMaxima`（session record）に次を保存する。

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

3. 代表ポリゴンに対し 2 分法で `t_base` を求める。
- 初期: `low=0`, `high=0.1`
- `high` で未達なら倍々で拡張（上限 `12`）
- 収束条件: `high-low < 1e-7` または `maxIterations=32`

4. Source task の `metadata.fetchDetail` に下記を保存する。
- `maxPolygonVertexCount.{input,output}`
- `baseTolerance`
- `baseToleranceVertexLimit`

5. `shapePipelineSourceStage` で全 Source task を集約し、`maxPolygonVertexCount` が最大の task に対応する `baseTolerance` を session の `sourceStageMaxima` に保存する。

## Geometry ステージ仕様

1. Geometry stage 開始時に session を読み、`sourceStageMaxima.baseTolerance` を取得する。

2. `baseTolerance` がある場合:
- task 内で代表 feature の再探索をしない
- `t_final = clamp(t_base * multiplier, t_base * minRatio, t_base * maxRatio)` を初回 tolerance とする

3. `baseTolerance` が無い場合:
- 既存の task 内代表 feature 探索 + 2 分法をフォールバックとして使用する

4. 初回 simplify 後に頂点上限未達の feature がある場合:
- 既存の `retrySimplifyFeatureWithinVertexLimit` を用いて規定回数内で再試行する

## 設定値方針

`multiplier/minRatio/maxRatio` はすべて `t_base=1.0` 基準の比率として扱い、範囲は `0.0..2.0` とする。

- `multiplier`: 中心値
- `minRatio`: 下限
- `maxRatio`: 上限

デフォルトは次を推奨する。

- `multiplier=1.0`
- `minRatio=0.0`
- `maxRatio=2.0`

## 旧方式・互換方針

- 旧設定（初期値 + 増分 + 試行回数）の互換読み込みは行わない。
- 新方式を唯一の有効仕様として扱う。

## 受け入れ基準

- Source 完了時に session へ `baseTolerance` が保存される。
- Geometry で session `baseTolerance` が優先利用される。
- `baseTolerance` 不在時は既存フォールバックで動作継続する。
- 既存 retry 処理で頂点上限制約を満たす。
