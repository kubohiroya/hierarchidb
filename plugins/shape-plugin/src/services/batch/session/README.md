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
- ✅ **vectortile orchestrator 化**: 進行中（次は Plan の Steps 3〜5）

---

# Plan: vectortile ステージの orchestrator 化（詳細）

- SessionController の processVectorTileStage() が 842行版では stub になっている一方、shape-plugin 側には vectortile 用の「タスク生成」「実行(adaptor呼び出し)」「完了後処理」「回帰(retry)」の部品が既に揃っています。そこで、download/extract1/extract2 と同じ粒度で「vectortile ステージ orchestrator」を新設し、SessionController は “入力を集めて orchestrator を呼ぶだけ” に薄くします。stub か実装ありかは SessionController.ts に実体が存在しないため、履歴/別ブランチ/他ファイルにある実装有無をまず判定して方針分岐します（stub維持/復元/既存移管）。

## Steps 1) 現状把握（stub か、既存実装が別にあるか）
- SessionController.ts の processVectorTileStage() が stubである事実を前提に、shape-plugin 内で vectortile 実装の所在を特定する。対象: session/stages/vectortile/*, adapters/RuntimeWorkerVectorTileAdapter.ts, session/vectorTileTasks.ts, SessionTaskRegistry.ts。
- Git 履歴/差分から “本来の processVectorTileStage 実装” が過去に存在したか確認し、存在するなら内容を抽出して「復元」か「移管」かを決める（存在しないなら stub維持寄りで設計）。
- SessionTaskRegistry.getVectorTileRegressionRetry() と prepareExtract2Retry() の関係（vectortile regression → extract2やり直し）を vectortile orchestrator 側で壊さない前提条件として整理する。

✅ 完了（vectortile 実装の所在を `session/stages/vectortile/*` に集約し、SessionController 側も実装済み）

## Steps 2) vectortile orchestrator の「契約」を定義する
 - download/extract1/extract2 と同様の形で runVectorTileStageOrchestrator を追加する（例: session/stages/vectortile/runVectorTileStageOrchestrator.ts）。
 - orchestrator の入出力を固定する（as any 禁止）。入力は最低限: nodeId, tasks, inputsByTaskId, taskRegistry, adapter, maxConcurrent, progressCallback, metadataEnabled。
 - orchestrator 内部で使う既存部品を明示する：
   - runnable 生成: resolveRunnableVectorTileTasks()
   - adapter 実行: runVectorTileAdapter()（= VectorTileStageAdapter.process 呼び出し）
   - 進捗整形: buildVectorTileProgressReporter()
   - 完了後処理: postprocessVectorTileStage()（メタデータ更新や sync をここに集約）

✅ 完了（Plan A により `waitIfPaused/getSignal/requestPause` は optional 受け取りで、未指定時は default controls を適用）

## Steps 3) vectortile の “タスク生成〜登録” を SessionController から分離
 - vectortile 入力タイル行の生成ロジックがどこにあるかを確認し、なければ session 層に「tile index 生成」関数を追加する（候補: session/tileIndex.ts, session/tiles/*）。
 - buildVectorTileTasks()（session/vectorTileTasks.ts）を統一エントリにして、SessionController は「tileRows を作る→tasks/inputsByTaskId を得る」だけにする。
 - SessionTaskRegistry.registerTasks('vectortile', ...) を orchestrator の冒頭に寄せ、SessionController から “DB登録の詳細” を剥がす（download/extract系と同様の責務分離）。

✅ 完了（登録は orchestrator 側で実施。入力は `buildVectorTileStageInputs()` が tasks/inputsByTaskId を返す）

## Steps 4) stub/復元/移管の方針分岐を手順化する
 - stub維持ルート: processVectorTileStage() は orchestrator 呼び出しだけ実装し、既存 adapter（RuntimeWorkerVectorTileAdapter）＋既存 postprocess で最小動作にする（現状のテストを壊さない優先）。
 - 復元ルート: Git 履歴等で見つかった旧 processVectorTileStage の “ビジネスロジック” を runVectorTileStageOrchestrator と postprocessVectorTileStage に分割し、SessionController は thin に保つ。
 - 既存実装移管ルート: もし vectortile ロジックが RuntimeWorkerVectorTileAdapter.ts に過密に存在する場合、adapter の責務を “ワーカー呼び出し＋結果保存” に限定し、タスク/進捗/メタデータは orchestrator に戻す（型は VectorTileStageAdapter 契約に合わせる）。

🟡 実質的に stub 維持ルートで進行（SessionController は orchestrator 呼び出し中心。必要に応じて復元/移管を追加検討）

## Steps 5) SessionController を薄くする（download/extract と同じ形に揃える）
 - SessionController.initialize() に vectortile adapter の生成を追加し、processVectorTileStage() は「必要データ収集→orchestrator 呼び出し→ログ」だけにする。
 - pause/abort は `StagePauseAbortControls`（download/extract1/extract2）・`StageControls`（vectortile）で表現し、SessionController は UI pause/abort を確実に伝播させるため `waitIfPaused/getSignal` を明示配線する。
 - vectortile は adapter 実行中の自発 pause 要求のため `requestPause` も配線する。
 - regression（start() の while ループ）で “vectortile regression → extract2 retry→vectortile 再実行” の前提が崩れないよう、vectortile orchestrator で task status 更新（regression/waiting/completed）境界を明確化する。

✅ 完了（regression retry は helper 化済み。controls 配線も統一）

## Steps 6) 既存テスト green を守るための最小追加テストだけ足す
 - session/stages/vectortile/* に unit テストを追加/更新し、「runnable のスキップ」「progress reporter の baseCompleted/baseFailed 加算」「postprocess 呼び出し順」を固定する（既存 vectorTileTasks.test.ts も活用）。
 - typecheck で VectorTileStageAdapter 契約が破れていないこと、SessionController が as any なしでコンパイルできることを確認する。
 - Further Considerations
 - vectortile 入力の tileRows はどこで作るべき？ Option A: session/tileIndex.ts で責務固定 / Option B: adapter 内で生成（非推奨）
 - メタデータ更新（summarizeVectorTilesByOrigin）は常に実行？ Option A: isShapePreviewMetadataEnabled() に合わせる / Option B: config に vectorTiles.metadataEnabled を追加して明示制御

🟡 テストは既存の unit を維持しつつ green を継続中。必要に応じて postprocess の順序などのテストを追加する。
