# transform タイルインデックス精度向上（shape）

この ExecPlan は `PLANS.md` に従う。進行に合わせて `Progress` / `Surprises & Discoveries` / `Decision Log` / `Outcomes & Retrospective` を更新する。

## 目的 / 背景

transform ステージで生成する `tileIndexBand` の精度を高め、vt ステージでの「空タイル」生成を削減する。
新設計では `shape-fetch → transform → vt` を採用し、transform で **geojson-vt による tile index 生成**を標準化する。

## Progress

- [ ] (2026-01-12) transform の tileIndexBand 生成を geojson-vt に統一し、bbox 依存を排除する
- [ ] (2026-01-12) 既存データセットで tilesWithoutFeatures の変化を測定する
- [ ] (2026-01-12) 影響と判断を Decision Log に記録する

## Surprises & Discoveries

- まだ記録なし

## Decision Log

- Decision: transform の tileIndexBand は geojson-vt のタイル生成結果を基準に決定する
  Rationale: 形状の交差判定を bbox で済ませると空タイルが増えるため
  Date/Author: 2026-01-12, assistant

## Outcomes & Retrospective

- 未完了

## 対象スコープ

- 対象: shape の transform
- 対象ジオメトリ: Polygon / MultiPolygon
- 目的: tileIndexBand の精度向上（空タイル削減）

## 新設計における位置付け

- stage1: `shape-fetch`
- stage2: `transform`
- stage3: `vt`
- tileIndexBand は **transform で生成**し、vt は tileIndexBand を入力にタイル生成を行う

## 設計要件

- tileIndexBand 生成に bbox 判定のみを使わない
- tileIndexBand 生成に **geojson-vt** を使用する
- tile coverage の前提確認には **turf** を用いる
- 空タイル削減は **視覚的な欠落を生まない**ことが前提

## 変更対象（想定）

- `packages/vt-orchestrator/src/transform/tileIndexWriter.ts`
- `packages/vt-orchestrator/src/transform/transformBand.ts`
- `packages/vt-shape-store/src/mutation/transformMutation.ts`
- `packages/vt-shape-store/src/query/tileIndexQuery.ts`

## 作業手順（概要）

1. transformBandBuffers から geojson-vt で tile index を生成する実装を確認/追加する
2. tileIndexBand に保存するタイル集合を geojson-vt の生成結果と一致させる
3. 既存の bbox ベース処理が残っていれば削除する
4. 代表データセットで `tilesWithoutFeatures` の変化を測定する
5. 結果を Decision Log / Outcomes に記録する

## 検証観点

- 空タイル数（tilesWithoutFeatures）が減少している
- 可視化で欠落が発生していない
- 実行時間が許容範囲に収まる

## 参考メトリクス

- vt ログの tilesWithFeatures / tilesWithoutFeatures
- transform の tileIndexBand 件数

## リスクと対策

- tileIndex の精度を上げすぎて欠落が発生する場合は、turf による coverage を見直す
- geojson-vt の生成コストが増える場合は maxBuffersPerTask / maxVerticesPerTask の調整を検討する
