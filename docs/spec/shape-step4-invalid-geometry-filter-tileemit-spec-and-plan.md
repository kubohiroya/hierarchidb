# Shape Step4 Invalid Geometry Filtering: TileEmit 移設仕様と作業計画

## 1. 目的
- Step4 Config の `Invalid geometry filtering` を Source セクションから TileEmit セクションへ移設する。
- `geojson-vt` に GeoJSON を投入する直前のデータに対して invalid geometry filtering を適用する。
- invalid polygon 検出時は該当 polygon を除外し、feature 単位の error count をインクリメントする。
- タスクの実行方針は「処理継続 + warning 表示（完了とは視覚的に区別）」を採用する。

## 2. 背景
- データソース由来の生データは、運用上ある程度クリーンであることが期待できる。
- 実際の破綻ポイントは、RDP 等の簡略化や変換後に生じる自己交差・退化リングなどである。
- そのため、Source での早期判定よりも、TileEmit 直前（最終投入前）の判定が目的適合性・再現性ともに高い。

## 3. 決定事項
### 3.1 配置（UI）
- Step4 の `Source` セクションから `Invalid geometry filtering` 設定UIを削除する。
- Step4 の `TileEmit` セクションに `Invalid geometry filtering` 設定UIを配置する。
- 既存の入力項目（`area`, `lineLength`, `maxEdgeLength`, `selfIntersection`, `triangleRingRatio`）は原則維持する。

### 3.2 実行タイミング（Worker）
- 適用タイミングは `geojson-vt` index 作成直前の GeoJSON collection とする。
- フィルタ対象は Polygon / MultiPolygon の polygon 単位とする。
- 判定に失敗した polygon は出力対象から除外する。

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
- Task status に warning 表示状態を導入する。
- 実装方式は次のいずれかとする。
- A) `status='completed'` を維持し `resultSeverity='warning'` を追加
- B) `status='warning'` を新設し、completed と同系列の終端状態として扱う
- 本仕様では UI/集計の互換性を優先し、**A案を推奨**する。

## 5. メトリクスと表示
- Task detail に以下を表示する。
- `invalidPolygonFilteredCount`
- `invalidPolygonCheckedCount`
- `invalidPolygonFilteredRate`（`filtered/checked`）
- `affectedFeatureCount`
- `featureErrorCountTotal`
- Task list では warning アイコン/色を表示し、hover/detail で理由を確認可能にする。

## 6. 実行アルゴリズム（TileEmit直前）
1. Transform 出力 GeoJSON collection を受け取る。
2. feature ごとに polygon を走査する。
3. enabled な invalid checks を適用する。
4. invalid polygon を除外し、feature error count を加算する。
5. polygon が 0 になった feature は feature 自体を除外する。
6. 集計メタデータを task に保存する。
7. フィルタ済み GeoJSON を `geojson-vt` に投入する。
8. `invalidPolygonFilteredCount > 0` の場合は warning 表示対象にする。

## 7. 互換性・移行方針
- 既存 `fetchConfig.invalidGeometryFilter` は段階的に廃止し、`tileEmitConfig.invalidGeometryFilter` へ移行する。
- 互換読み込みは移行期間のみ許容し、優先順は `tileEmitConfig` を上位とする。
- 移行完了後は `fetchConfig.invalidGeometryFilter` を削除対象とする。

## 8. ロールバック方針
- UI移設で問題が出た場合は、設定UIを Source へ戻し、worker 側適用点を元に戻す。
- warning 表示で既存監視が崩れる場合は、warning 表示のみを feature flag で無効化できるようにする。
- データ破損は発生しない設計（drop-only）を維持し、戻しやすさを優先する。

## 9. 作業計画
### 9.1 実装分割
- Phase 1: 型定義/設定キー移設
- Phase 2: Step4 UI の TileEmit への移設（i18n含む）
- Phase 3: TileEmit 直前 filtering 実装
- Phase 4: warning 表示導入（Task list/detail）
- Phase 5: 互換読み込み/移行ロジック整備
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
- `tileEmitConfig` 優先、`fetchConfig` 後方互換が期待どおりであること

## 10. DoD
- Step4 の Invalid geometry filtering が TileEmit セクションで設定できる。
- invalid geometry filtering が geojson-vt 直前に適用される。
- invalid polygon は除外され、feature error count が増加する。
- タスクは継続し、warning として completed と区別表示される。
- 主要テストが追加され、対象パッケージの typecheck/test が通る。

## 11. 非採用案
- (1) 完了扱いのみ: 品質劣化が埋もれるため不採用。
- (3) 継続しつつ error: 実態（処理継続）と表示（失敗）が乖離するため不採用。
- (4) 即中止: 可用性を大きく下げるため既定動作として不採用。
