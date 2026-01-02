# Plan: vectortile ステージの orchestrator 化

SessionController の processVectorTileStage() が 842行版では stub になっている一方、shape-plugin 側には vectortile 用の「タスク生成」「実行(adaptor呼び出し)」「完了後処理」「回帰(retry)」の部品が既に揃っています。そこで、download/extract1/extract2 と同じ粒度で「vectortile ステージ orchestrator」を新設し、SessionController は “入力を集めて orchestrator を呼ぶだけ” に薄くします。stub か実装ありかは SessionController.ts に実体が存在しないため、履歴/別ブランチ/他ファイルにある実装有無をまず判定して方針分岐します（stub維持/復元/既存移管）。
## Steps 1) 現状把握（stub か、既存実装が別にあるか）
- SessionController.ts の processVectorTileStage() が stubである事実を前提に、shape-plugin 内で vectortile 実装の所在を特定する。対象: session/stages/vectortile/*, adapters/RuntimeWorkerVectorTileAdapter.ts, session/vectorTileTasks.ts, SessionTaskRegistry.ts。
- Git 履歴/差分から “本来の processVectorTileStage 実装” が過去に存在したか確認し、存在するなら内容を抽出して「復元」か「移管」かを決める（存在しないなら stub維持寄りで設計）。
- SessionTaskRegistry.getVectorTileRegressionRetry() と prepareExtract2Retry() の関係（vectortile regression → extract2やり直し）を vectortile orchestrator 側で壊さない前提条件として整理する。

## Steps 2) vectortile orchestrator の「契約」を定義する
- download/extract1/extract2 と同様の形で runVectorTileStageOrchestrator を追加する（例: session/stages/vectortile/runVectorTileStageOrchestrator.ts）。
- orchestrator の入出力を固定する（as any 禁止）。入力は最低限: nodeId, tasks, inputsByTaskId, taskRegistry, adapter, maxConcurrent, waitIfPaused, getSignal, progressCallback, metadataEnabled。
- orchestrator 内部で使う既存部品を明示する：
  - runnable 生成: resolveRunnableVectorTileTasks()
  - adapter 実行: runVectorTileAdapter()（= VectorTileStageAdapter.process 呼び出し）
  - 進捗整形: buildVectorTileProgressReporter()
  - 完了後処理: postprocessVectorTileStage()（メタデータ更新や sync をここに集約）

## Steps 3) vectortile の “タスク生成〜登録” を SessionController から分離
- vectortile 入力タイル行の生成ロジックがどこにあるかを確認し、なければ session 層に「tile index 生成」関数を追加する（候補: session/tileIndex.ts, session/tiles/*）。
- buildVectorTileTasks()（session/vectorTileTasks.ts）を統一エントリにして、SessionController は「tileRows を作る→tasks/inputsByTaskId を得る」だけにする。
- SessionTaskRegistry.registerTasks('vectortile', ...) を orchestrator の冒頭に寄せ、SessionController から “DB登録の詳細” を剥がす（download/extract系と同様の責務分離）。

## Steps 4) stub/復元/移管の方針分岐を手順化する
- stub維持ルート: processVectorTileStage() は orchestrator 呼び出しだけ実装し、既存 adapter（RuntimeWorkerVectorTileAdapter）＋既存 postprocess で最小動作にする（現状のテストを壊さない優先）。
- 復元ルート: Git 履歴等で見つかった旧 processVectorTileStage の “ビジネスロジック” を runVectorTileStageOrchestrator と postprocessVectorTileStage に分割し、SessionController は thin に保つ。
- 既存実装移管ルート: もし vectortile ロジックが RuntimeWorkerVectorTileAdapter.ts に過密に存在する場合、adapter の責務を “ワーカー呼び出し＋結果保存” に限定し、タスク/進捗/メタデータは orchestrator に戻す（型は VectorTileStageAdapter 契約に合わせる）。

## Steps 5) SessionController を薄くする（download/extract と同じ形に揃える）
- SessionController.initialize() に vectortile adapter の生成を追加し、processVectorTileStage() は「必要データ収集→orchestrator 呼び出し→ログ」だけにする。
- pause/abort は既存の waitForStageResume('vectortile') と getStageAbortSignal('vectortile') を orchestrator に渡して統一する（as any を使わず StageControls で表現）。
- regression（start() の while ループ）で “vectortile regression → extract2 retry→vectortile 再実行” の前提が崩れないよう、vectortile orchestrator で task status 更新（regression/waiting/completed）境界を明確化する。

## Steps 6) 既存テスト green を守るための最小追加テストだけ足す
- session/stages/vectortile/* に unit テストを追加/更新し、「runnable のスキップ」「progress reporter の baseCompleted/baseFailed 加算」「postprocess 呼び出し順」を固定する（既存 vectorTileTasks.test.ts も活用）。
- typecheck で VectorTileStageAdapter 契約が破れていないこと、SessionController が as any なしでコンパイルできることを確認する。
- Further Considerations
- vectortile 入力の tileRows はどこで作るべき？ Option A: session/tileIndex.ts で責務固定 / Option B: adapter 内で生成（非推奨）
- メタデータ更新（summarizeVectorTilesByOrigin）は常に実行？ Option A: isShapePreviewMetadataEnabled() に合わせる / Option B: config に vectorTiles.metadataEnabled を追加して明示制御