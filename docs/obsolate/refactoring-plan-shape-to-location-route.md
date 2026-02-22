# Refactoring plan: shape-plugin → location-plugin / route-plugin 共用化

最終目的は、shape-plugin で確立したバッチ処理（download → extract* → vectortile）のアーキテクチャを **正**として、location-plugin / route-plugin も同じ枠組みで WebWorker 並列ビルドできるようにすることです。

- 生成されるベクトルタイルは `@hierarchidb/vectortile-store`（TilesDB）互換の Dexie DB として保存し、`@hierarchidb/ui-map` で描画できること。
- 既存の `@hierarchidb/gis-sdk` に残る旧共通化実装は、最終的に **互換層（facade/re-export）へ縮退**させる。

---

## 背景と現状

### 共通点（shape / location / route）

- 入力は違っても、vectortile 生成直前には **GeoJSON/FeatureCollection に揃う**
- タイル bbox と feature の **交差/抽出/再構成** を行い、MVT を生成する
- WebWorker による並列化 + 進捗報告 + pause/abort が必要

### 相違点（主に前処理）

- shape: 形状データ（shp/topojson/fgb 等）
- location/route: URL/ローカルファイルの表 → 抽出/変換 → GeoJSON

したがって、共通化は「vectortile ステージ以降」を中核にしつつ、download/extract の骨格・永続化ポート・Worker 実行基盤も横断的に共通化する。

---

## ガードレール（事故予防ポリシー）

### 1) Cross-package deep import 禁止

- `plugins/*` から `packages/*/src/*` への import 禁止
- `../../../../packages/*` のような深い相対 import 禁止

→ すべて workspace package の公開 entry（exports/dist）経由で参照する。

### 2) `as any` 禁止

- 共通化の途中で「型で負債を隠す」ことを避ける
- 変換が必要な箇所は port で型を明示し、adapter で変換する

### 3) Policy B（進捗通知の厳格契約）

`@hierarchidb/vectortile-orchestrator` は **Orchestrator が進捗イベントを合成**するため、
`progressCallback` を渡す場合は **必ず** `progressFactory` も渡す。

- 理由: runnableTasks=0 の早期 return パスでも progress を通知する必要がある
- 詳細: `packages//README.md` を参照

---

## 共通化の対象（おすすめ順）

> 低リスク・高リターンの順。

### 1) Layer0: `build-session-ports` を新設（型/ポートのみ）

**目的**: orchestrator をアプリ/プラグイン実装から切り離すための最小契約を固める。

- TaskRegistryPort（registerTasks / resolveStageTasks / loadStageInputs など）
- ArtifactStorePort（put/get/list buffers）
- ProgressInfoBase（最小進捗 shape）

成果物（予定）:
- `packages//`（新規）

### 2) Layer1: download/extract 系の orchestrator 骨格を共通化

**目的**: download/extract1/extract2 の「繰り返し構造」を共通化して、location/route でも同型にする。

- `runStageOrchestrator<TTask,TInput,TProgress>`
- StageControls（pause/abort/maxConcurrent/requestPause）
- StageSummary（total/completed/failed/skipped）

### 3) メタデータ・統計（metadata pipeline）を共通化

**目的**: origin 別統計や sourceMetadata 更新などの共通化。

- ただし row schema 自体は domain 依存が強いので、契約/パターン中心に。

---

## 実装移行のステップ（shape を正として進める）

### Step A: 現状固定（まず壊さない）

- shape-plugin を正として、既存の振る舞いを変えずに共通パッケージの土台だけ増やす
- 変更後に必ず typecheck+unit test を green にする

### Step B: shape-plugin を共通 ports/orchestrator に寄せる

- `SessionTaskRegistry` / `SessionArtifactStore` を ports 実装に適合
- download/extract の実行を共通 stage orchestrator 経由に段階的に切り替え

### Step C: location-plugin / route-plugin へ横展開

- 前処理（表→GeoJSON）は plugin 側に残す
- vectortile 以降は
  - `@hierarchidb/vectortile-orchestrator`
  - `@hierarchidb/vectortile-store`
  - （将来的に）共通 worker 実行基盤
 へ接続する

### Step D: gis-sdk の置換・縮退

- 既存 API を壊さないために facade として残す
- 中身は共通実装（orchestrator/pipeline/store）へ委譲

---

## リスクと非推奨（共通化しない方が良いもの）

- shape 固有の originKey 取り扱い（例: HDB_ORIGIN_KEY）や featureId 付与など
- regression retry のような domain policy（共通化はせず拡張ポイントで吸収）
- Dexie row schema を完全に統一すること（TilesDB 互換以外は各 domain で異なる）

---

## Done / Next

### Done

- vectortile orchestrator を `@hierarchidb/vectortile-orchestrator` に昇格
- deep import 禁止（ESLint）
- Policy B（progressCallback → progressFactory 必須）を README で固定

### Next

- `packages//` の新設（Layer0）
- shape-plugin の download/extract を Layer1 orchestrator 骨格へ寄せる
