# Shape4 Geometry Tolerance 新方式仕様（t_base 2分法 + multiplier/min/max）

## 目的

Shape4 の Geometry ステージで、従来の「tolerance を増分で段階的に上げる再試行」を置き換える。新方式は Source ステージで既に保持している頂点統計を利用し、`turf.simplify` の基準 tolerance（`t_base`）を 2 分法で求める。これにより、巨大国と小国の複雑性差を吸収しつつ、頂点上限（`6553`）を満たすための試行回数を削減する。

## 背景と課題

現行方式は `retryToleranceByBand` と `retryCount` に依存し、オーバーしたフィーチャーごとに tolerance を増やしながら再簡略化する。これは次の課題を持つ。

- 元ポリゴン複雑性が極端に異なるデータセットで、必要試行回数が読みにくい。
- 「どの tolerance を目標にするか」が事前に定義されず、失敗条件が相対的になりやすい。
- UI 設定が「初期値・増分・回数」に分かれており、調整意図が読み取りづらい。

## 適用対象

- 対象ステージ: Shape4 Geometry（`createTransformByBandHandler` 経路）
- 対象アルゴリズム: `turf.simplify` を使う geojson simplify 系処理
- 頂点制約: 1 フィーチャーあたり `6553` 以下（現行制約を維持）

## 用語定義

- `vertexLimit`: システム上限頂点数。既定 `6553`。
- `maxSourcePolygonVertices`: Source ステージ統計から得る「1 ポリゴン頂点数最大値」。
- `t_base`: 最大頂点ポリゴンを `vertexLimit` 以下にする最小 tolerance。
- `multiplier`: `t_base` に掛ける係数（中心値）。
- `minRatio` / `maxRatio`: `t_base` 比の下限・上限。
- `t_final`: 実際に簡略化へ渡す tolerance。

## 方式概要

1. Source ステージ統計（sessions 保存済み）から、最大頂点ポリゴンを代表サンプルとして選ぶ。  
2. 代表サンプルに対して `turf.simplify` を適用し、`maxVertices <= 6553` を満たす最小 tolerance を 2 分法で探索する。  
3. 得られた `t_base` を基準に、自治体レベル × ズームの設定 `multiplier/minRatio/maxRatio` を適用する。  
4. 各フィーチャーの複雑性に応じて `t_base` より小さい初期推定値を生成し、必要な場合のみ少回数の補正探索を行う。  

## 2 分法探索仕様

### 入力

- `polygon`: 最大頂点ポリゴン（Source 統計で選定）
- `vertexLimit`: 6553
- `toleranceLow`: 0
- `toleranceHigh`: 初期上限（推奨 `t_baseUpperStart = 1.0`）
- `eps`: 収束閾値（推奨 `1e-7`）
- `maxIterations`: 反復上限（推奨 24）

### 上限拡張

`toleranceHigh` で条件を満たさない場合は、`toleranceHigh *= 2` で段階拡張する。上限 `toleranceHighCap`（推奨 12.0）に達しても満たせない場合は探索失敗とし、従来失敗ハンドリングへ移行する。

### 判定関数

`f(t) = simplify(polygon, t).vertexCount - vertexLimit`

- `f(t) <= 0` なら条件達成
- `f(t) > 0` なら未達

### 収束

- ループごとに `mid = (low + high) / 2` を評価
- `f(mid) <= 0` なら `high = mid`
- `f(mid) > 0` なら `low = mid`
- `|high - low| < eps` または `iteration == maxIterations` で終了
- 終了値 `t_base = high`

## tolerance 決定式

### 正規化レンジ

`multiplier`, `minRatio`, `maxRatio` はすべて `0.0..2.0` の範囲で定義する。

### 制約

- `0.0 <= minRatio <= maxRatio <= 2.0`
- `multiplier` も `0.0..2.0` にクランプ

### 実効値

`candidate = t_base * multiplier`  
`t_final = clamp(candidate, t_base * minRatio, t_base * maxRatio)`

## 複雑性ベース初期推定（後段最適化）

各フィーチャーの頂点数 `v` と、代表サンプル頂点数 `v_max` から比率を作る。

- `r = clamp(log(v) / log(v_max), 0, 1)`
- `t_est = t_base * (r ^ gamma)`（推奨 `gamma=1.4` 初期）

`r` が小さい（小規模形状）ほど低い tolerance で開始し、上限超過時のみ少回数の補正探索を行う。

## 設定モデル（新旧）

### 新モデル（主系）

- `simplifyToleranceByAdminLevel.<admin>.multiplierByBand[]`
- `simplifyToleranceByAdminLevel.<admin>.minRatioByBand[]`
- `simplifyToleranceByAdminLevel.<admin>.maxRatioByBand[]`
- `simplifyToleranceByAdminLevel.<admin>.usePrevious`
- `geometryConfig.toleranceSearchMaxIterations`（全体共通）

### 旧モデル（移行期間）

- `toleranceByBand`
- `retryToleranceByBand`
- `retryCount`

旧モデルは読み取り互換のみ残し、内部評価は新モデル優先とする。互換期間終了後に削除する。

## UI 仕様（ToneCurveEditor）

- 線 1（青実線）: `multiplier`
- 線 2（灰点線）: `minRatio`
- 線 3（赤点線）: `maxRatio`

UI ルール:

- 値域は `0.0..2.0` 固定
- 常に `minRatio <= multiplier <= maxRatio` を維持（ドラッグ時自動クランプ）
- Admin0 変更は既存仕様どおりベース `geometryConfig` へ同期
- 旧設定読み込み時は `multiplier` へ寄せ、`minRatio/maxRatio` は安全デフォルトで補完

## デフォルト値方針

初期デフォルト（共通）:

- `multiplier = 1.0`
- `minRatio = 0.0`
- `maxRatio = 2.0`
- `toleranceSearchMaxIterations = 24`

運用初期はズーム帯で `multiplier` のみ段階補正し、`min/max` は安全ガードとして広めに維持する。

## 失敗時挙動

次の場合は `geometry failed` を返す。

- `t_base` 探索で上限拡張後も `vertexLimit` を満たせない
- 補正探索の上限反復で `vertexLimit` 未達
- simplify 処理自体が例外終了

エラーメッセージには最低限以下を含める。

- `vertexLimit`
- `baseTolerance`（`t_base`）
- `finalTolerance`
- `attempts`
- `maxVertices`

## 観測性（ログ・メタデータ）

Geometry 結果メタデータに次を保存する。

- `baseTolerance`
- `effectiveTolerance`
- `multiplier/minRatio/maxRatio`
- `vertexLimit`
- `searchIterations`
- `searchOutcome`（`converged` / `failed`）

## 段階移行方針

1. 新方式を feature toggle（既定 ON/OFF は Issue で明示）で導入  
2. 旧設定を読み取り互換で保持しつつ UI では `deprecated` 表示  
3. 安定確認後、旧 `retryToleranceByBand/retryCount` を撤去  
4. 互換削除時に migration note を残す  

## 受け入れ基準（仕様レベル）

- `t_base` の探索手順と停止条件が明文化されている。
- `multiplier/minRatio/maxRatio` の定義と計算式が一意である。
- ToneCurveEditor の 3 線 UI 仕様と制約が定義されている。
- 旧方式からの移行・ロールバック方針が記載されている。

## 非目標

- 本仕様書では実装コード変更を行わない。
- 本仕様書では DB マイグレーション実装詳細を固定しない（実装計画で確定）。
