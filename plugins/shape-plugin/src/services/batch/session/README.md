# セッション実行（batch/session）開発者向けドキュメント

このディレクトリは、shape-plugin のバッチ処理（download → extract1 → extract2 → vectortile）を
**SessionController から責務分割していくための「実行ロジック本体」**を置く場所です。

## 全体像

- ステージは `download` → `extract1` → `extract2` → `vectortile` の順に実行されます（ステージ間は逐次）。
- ステージ内部は複数タスクを **並列実行**します（主に WebWorker 経由）。
- 中断/再開/中止（pause/resume/abort）と進捗通知（ProgressInfo）は、ステージ横断で共通の形を保つように設計されています。

## 実行モデル：並列実行（WebWorker）・中断/再開・進捗報告

このセッションの実行は、基本的に **「ステージ単位（download/extract1/extract2/vectortile の順）」**で進みます。
一方で、各ステージの中では **複数タスクを並列に処理**します（主に WebWorker 経由）。

### 並列実行の開始（どこで並列が始まるか）

- ステージ単位の流れは `SessionController.start()` が順次呼び出します。
  - `processDownloadStage()` → `processExtract1Stage()` → `processExtract2Stage()` → `processVectorTileStage()`
- 各ステージは orchestrator に処理を委譲し、**並列度（同時実行数）は `maxConcurrent`** として渡します。
  - download: `runDownloadStageOrchestrator({ maxConcurrent, adapter, ... })`
  - extract1: `runExtract1StageOrchestrator({ maxConcurrent, adapter, ... })`
  - extract2: `runExtract2StageOrchestrator({ maxConcurrent, adapter, ... })`
  - vectortile: `runVectorTileStageOrchestrator({ maxConcurrent, adapter, ... })`

並列処理そのもの（タスクを同時に処理する実体）は **adapter 側**にあり、orchestrator は
「runnable を解決 → adapter 実行 → 後処理」までのライフサイクルを統一します。

### 中断（pause）と中止（abort）の仕組み

中断/再開は `SessionController` が **ステージ単位**で管理します。

- `pauseStage(stage)`
  - `pausedStages.add(stage)`
  - `isPaused = true`
  - `abortStageController(stage)` により **そのステージ専用の `AbortController` を abort**
- `resumeStage(stage)`
  - `pausedStages` から削除し、ステージ用 `AbortController` を作り直す
  - `waitForStageResume(stage)` を待っている処理を解放

#### StageControls（Plan A）: orchestrator 側のデフォルト + SessionController 側の明示配線

orchestrator は共通して `waitIfPaused/getSignal`（場合によっては `requestPause`）を受け取りますが、
**Plan A として orchestrator 側では controls を optional 受け取りに寄せ、未指定時は `defaultStageControls()` で安全に動く**ようにしています。

- 目的：将来、SessionController 以外から orchestrator を呼び出す場合でも、最小引数で安全に動作できるようにする
- ただし形状は2種類に分ける（`session/stages/common/buildStageControls.ts`）：
  - `StagePauseAbortControls`（pause/abortのみ）
    - `waitIfPaused: () => Promise<void>`
    - `getSignal: () => AbortSignal`
  - `StageControls`（requestPause 付き）
    - `StagePauseAbortControls` + `requestPause: (message: string) => Promise<void>`

`SessionController` は UI からの pause/abort を確実にステージ実行へ伝播させるため、
download/extract1/extract2/vectortile すべてに `waitIfPaused/getSignal` を **明示的に渡し続けます**。

一方で、`requestPause` は vectortile のみが必要です。

- download/extract1/extract2: `StagePauseAbortControls` を使う（requestPause は配線しない）
- vectortile: `StageControls` を使う（adapter 実行中に「自発的に pause を要求」できる）

vectortile の `requestPause` は `SessionController` 側で `pauseStage('vectortile')` を呼び出し、
同じ pause/resume 仕組みに合流させています。

### 進捗報告（ProgressInfo）の仕組み

進捗は `ProgressInfo`（`common/types`）で統一し、各ステージ orchestrator が `progressCallback` を通して UI 側へ通知します。

重要なのは、「今回の実行分」だけでなく **既に完了しているタスク（前回実行・リトライ前など）を含めた累積進捗**として報告する点です。

- まず taskRegistry（DB）から runnable 判定を行い、
  - `total`
  - `baseCompleted`（既に完了済みの数）
  - `baseFailed`（既に失敗済みの数）
  を確定します。
- adapter が報告する進捗（増分）を `baseCompleted/baseFailed` に足し込んで `percentage` を計算します。

vectortile ステージはこれが最も分かりやすく、
`session/stages/vectortile/runVectorTileStageOrchestrator.ts` が

- `resolveRunnableVectorTileTasks`（DB 状態から runnable と base を算出）
- `buildVectorTileProgressReporter`（base を考慮して progressCallback を発火する関数を生成）
- `runVectorTileAdapter`（並列実行。ここで増分の進捗が発生）

という順で処理しています。

補足:
- extract1/extract2 の WebWorker 実行は、それぞれ `ShapeWorkerExtract1Adapter` / `ShapeWorkerExtract2Adapter`（adapter 実装）側が担います。
- vectortile の WebWorker 実行は `RuntimeWorkerVectorTileAdapter`（adapter 実装）側が担います。
- orchestrator は「Worker 実行の詳細」は持たず、**並列度・pause/abort・進捗の契約（型）を揃える役**を担当します。

## ディレクトリ構成（責務マップ）

`plugins/shape-plugin/src/services/batch/session/` は、SessionController から剥がしたセッション実行関連の部品を責務単位で配置します。

- `controller/`
  - セッション実行の薄い制御/ポート層（必要に応じて追加）
- `orchestrators/`
  - download/extract*/vectortile など「ステージ横断の実行オーケストレーション」
- `stages/`
  - 各ステージ固有の orchestrator/adapter 呼び出し/後処理
- `extract1/`, `extract2/`, `extract2Topojson/`
  - extract ステージのタスク生成や、extract2 の方式別実装
- `metadata/`
  - Source/Feature など「メタデータの永続」「更新」「集計」の中核
- `preview/`
  - プレビュー用の統計集計・メタデータ更新（UI 用の軽量/任意機能）
- `tasks/`
  - ステージ共通のタスク実行フロー（進捗/サマリ/メッセージ）
- `tiles/`
  - タイル入力（tile rows）生成、タイル索引、vectortile タスク生成
- `stats/`
  - Geometry などの統計ユーティリティ（横断）
- `codecs/`
  - GeoJSON/FlatGeobuf などの encode/decode（横断）
- `pickers/`
  - feature property picker のような「抽出ルール」ユーティリティ
- `ids/`, `types/`
  - ID 生成や共有型

※ 以前は移行用として `session/` 直下に re-export（`featureMetadata.ts` / `originMetadata.ts` / `sourceMetadata*.ts`）を置いていましたが、利用側の import をすべて `session/metadata/*` の本来の export に移行し、re-export は削除しました。

## 現状の達成状況（開発メモ）

- ✅ **ディレクトリ整理（責務分割）**: `preview/`, `tasks/`, `tiles/`, `stats/`, `codecs/`, `pickers/` への移設まで完了
- ✅ **import 修正・型チェック**: `tsc --noEmit` / `vitest` ともに green を維持
- ✅ **移行用 re-export の撤去**: 利用側を canonical import へ切替済み（re-export ファイル削除済み）
- ✅ **vectortile orchestrator 化**: Steps 1〜5 完了（残りは Steps 6: 追加テスト/整備）

---

# Plan: vectortile ステージの orchestrator 化（詳細）

- SessionController の processVectorTileStage() が 842行版では stub になっている一方、shape-plugin 側には vectortile 用の「タスク生成」「実行(adaptor呼び出し)」「完了後処理」「回帰(retry)」の部品が既に揃っています。そこで、download/extract1/extract2 と同じ粒度で「vectortile ステージ orchestrator」を新設し、SessionController は “入力を集めて orchestrator を呼ぶだけ” に薄くします。stub か実装ありかは SessionController.ts に実体が存在しないため、履歴/別ブランチ/他ファイルにある実装有無をまず判定して方針分岐します（stub維持/復元/既存移管）。

## 現在の状態（要約）

- ✅ Done（Steps 1〜5）
  - orchestrator: `session/stages/vectortile/runVectorTileStageOrchestrator.ts`
  - controls: Plan A（orchestrator 側 default + SessionController 側明示配線）
  - controls 形状: `StagePauseAbortControls`（download/extract1/extract2） / `StageControls`（vectortile）
  - regression retry: `SessionController.runVectorTileRegressionRetries()`
- 🟡 Remaining（Step 6）
  - 追加テスト（postprocess 呼び出し順、baseCompleted/baseFailed の加算、default controls の fallback など）

## Steps 1〜5（完了）

詳細は履歴として残しますが、現状の実装では Steps 1〜5 は完了しています。

- ✅ Steps 1) 実装の所在/責務の整理
- ✅ Steps 2) orchestrator 契約の固定（Plan A により controls optional + default 適用）
- ✅ Steps 3) タスク生成〜登録の分離（登録は orchestrator 側、入力は `buildVectorTileStageInputs()`）
- ✅ Steps 4) stub/復元/移管の方針（現在は stub 維持ルートで良好に動作）
- ✅ Steps 5) SessionController の thin 化（controls 統一 + regression retry helper 化）

## Steps 6（残り）: 既存テスト green を守るための最小追加テスト

目的：今回の refactor を「壊れにくい形」で固定する。

- [ ] `session/stages/vectortile/*` に unit テストを追加/更新
  - [ ] runnableTasks が 0 のときに afterRun が呼ばれ、progress が base 状態で通知される
  - [ ] baseCompleted/baseFailed が progress reporter に正しく足し込まれる
  - [ ] postprocess の呼び出し順が固定される（sync/metadata/update/clear など）
  - [ ] Plan A: controls 未指定でも defaultStageControls() で安全に動く
- [ ] typecheck で VectorTileStageAdapter 契約が破れていないこと
- [ ] `SessionController` が as any なしでコンパイルできること

Further Considerations:
- vectortile 入力の tileRows はどこで作るべき？ Option A: session/tileIndex.ts で責務固定 / Option B: adapter 内で生成（非推奨）
- メタデータ更新（summarizeVectorTilesByOrigin）は常に実行？ Option A: isShapePreviewMetadataEnabled() に合わせる / Option B: config に vectorTiles.metadataEnabled を追加して明示制御
