# @hierarchidb/vectortile-orchestrator

このパッケージは、**shape-plugin で確立した vectortile ステージのアーキテクチャ（orchestrator 中心）を正**として、他プラグイン（location/route など）から再利用可能な **共通 vectortile 生成基盤**へ昇格させるための置き場です。

> 目的：`download/extract*` と同様に、vectortile 生成を「契約（orchestrator）」「実処理（adapter/worker）」「永続化ストア（Dexie/TilesDB）」に分離し、プラグイン固有な前処理（GeoJSON生成など）だけを差し替え可能にする。

---

## 正とするアーキテクチャ（shape-plugin 準拠）

### 役割分担

- **Orchestrator（このパッケージの主役）**
  - runnable 解決（taskRegistry から DB 状態を読んで runnableTasks/baseCompleted/baseFailed を決める）
  - adapter 実行（maxConcurrent/StageControls で並列度・中断/再開を統一）
  - 進捗の合成（baseCompleted/baseFailed を含めた累積進捗として progressCallback に通知）
  - 後処理フック（postprocess port）を順序通りに呼び出す

- **Adapter（プラグイン or runtime-worker 側）**
  - WebWorker を使った並列タイル生成の実体
  - `VectorTileStageAdapter.process(tasks, onProgress, controls)` を実装

- **Store（Dexie 互換）**
  - 出力 vectortile は `@hierarchidb/ui-map` が描画できる Dexie スキーマ互換が必須
  - 正のスキーマは `@hierarchidb/vectortile-store` の `TilesDB` を採用する方針

### Plan A: StageControls のデフォルト

Orchestrator の入力として `waitIfPaused/getSignal/requestPause` は optional とし、未指定時は `defaultStageControls()` を適用して安全に動くようにします。

- 目的：SessionController 以外（location/route のような別実装）から orchestrator を呼ぶ際も、最小の引数で安全に呼べる。
- ただし UI からの pause/abort を確実に伝播させたい実装（shape-plugin の SessionController など）は、明示的に controls を渡し続ける。

---

## 共通化の適用対象（location/route との対応）

location/route はデータソースが「URL/ローカルファイルの表データ」である点が shape と異なりますが、**vectortile 生成の直前の入力が GeoJSON に揃う**ため、pipeline の後半は共通化できます。

共通化する範囲（目標）:

1. GeoJSON/FeatureCollection を入力として
2. タイルの bbox と交差する feature を抽出/再構成し
3. MVT（pbf/mvt）を生成し
4. `TilesDB` 互換ストアへ保存し
5. `@hierarchidb/ui-map` で描画可能にする

※このパッケージは「2〜5 を orchestrator 観点で統一」する。

---

## 移行プラン（段階的置換）

### Step 0: 現状（2026-01-03）

- shape-plugin 内に `runVectorTileStageOrchestrator` が存在
- `@hierarchidb/gis-sdk` に過去の共通化の残骸が残る

### Step 1: orchestrator を共通パッケージへ昇格（この作業）

- [ ] `session/stages/vectortile/*` のうち orchestrator の核を `@hierarchidb/vectortile-orchestrator` に移植
- [ ] shape-plugin は新パッケージを参照するように置換
- [ ] unit テスト（契約テスト）も共通側へ移動

### Step 2: runtime-worker から gis-sdk 直依存を剥がす

- [ ] runtime-worker の vectortile 生成を adapter 実装として整理
- [ ] 生成結果は TilesDB へ保存（Dexie互換）

### Step 3: location-plugin / route-plugin を同じ契約へ寄せる

- [ ] 前処理（表→GeoJSON）の違いは plugin 側で吸収
- [ ] vectortile 部分は共通 orchestrator + adapter で統一

### Step 4: @hierarchidb/gis-sdk は互換層へ縮退

- [ ] 既存exportを壊さないため facade/re-export として残す
- [ ] 中身の実装は新基盤（orchestrator/pipeline/store）へ委譲

---

## テスト戦略

このパッケージの unit テストは **抽象度を高く**保ちます。

- DB/Dexie の実体はモックし、以下の「契約」を固定する
  - runnableTasks が 0 のときの早期returnと base 進捗
  - Plan A（controls 省略）時の default controls 適用
  - postprocess 呼び出し順
  - baseCompleted/baseFailed を含めた進捗合成

より重い統合（GeoJSON→TilesDB→ui-map描画互換）は、別パッケージ（pipeline/store）側で最小ケースのみ実施します。

---

## 次に実装するファイル（予定）

- `src/vectortile/runVectorTileStageOrchestrator.ts`
- `src/vectortile/orchestratorTypes.ts`
- `src/vectortile/resolveRunnableVectorTileTasks.ts`
- `src/vectortile/runVectorTileAdapter.ts`
- `src/common/defaultStageControls.ts`
- `src/vectortile/postprocessVectorTileStage.ts`
- `src/index.ts`
- `src/vectortile/__tests__/runVectorTileStageOrchestrator.test.ts`


