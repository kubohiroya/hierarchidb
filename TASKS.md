2292) fix/shape/step6-preview-hover-snackbar (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step6-preview-hover-snackbar
- 依存: なし
- 受け入れ基準: Step6のプレビュー地図でホバー時にSnackbarが表示される／ホバーでハイライトが反映される／既存の選択や検索挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx`, `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`
- ロールバック手順: Step6のホバー連携差分を revert する
- チェックリスト:
  - Step6のResourceLayerMapでhoverを有効化する
  - mapHoverCandidatesからhoveredIdへ接続する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:40 JST Step6のホバー連携とSnackbar表示の修正に着手。
  - update: 2026-01-22 19:48 JST Step6でhoverを有効化し、mapHoverCandidatesからhoveredIdへ接続。
  - done: 2026-01-22 19:55 JST pnpm typecheck exit 0 を確認。

2276) fix/shape/step3-index-chip-highlight (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-chip-highlight
- 依存: なし
- 受け入れ基準: Step3のIndexチップで該当頭文字に選択済み国がある場合はprimary色になる／選択が無い場合は通常色のまま／スクロールや選択挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`
- ロールバック手順: Indexチップの色判定差分を revert する
- チェックリスト:
  - 頭文字グループ内に選択済みがあるか判定する
  - Indexチップにprimary色を反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 11:45 JST Step3のIndexチップを選択有無で色分けする対応に着手。
  - update: 2026-01-22 12:00 JST 頭文字グループ内の選択有無を判定し、Indexチップにprimary色を反映。
  - done: 2026-01-22 12:05 JST pnpm typecheck exit 0 を確認。

2277) fix/shape/step3-selected-country-primary (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-selected-country-primary
- 依存: なし
- 受け入れ基準: Step3で任意カラムに選択がある国名がprimary色になる／選択がない国は従来色のまま／既存の選択/スクロール/ソート挙動に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`
- ロールバック手順: 国名の色判定差分を revert する
- チェックリスト:
  - 国ごとの選択有無を判定する
  - 国名の色をprimaryへ反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 12:20 JST 選択済みの国名をprimary色で表示する対応に着手。
  - update: 2026-01-22 12:35 JST 選択済み国の判定を追加し、国名の色をprimaryに切替。
  - done: 2026-01-22 12:40 JST pnpm typecheck exit 0 を確認。

2278) fix/shape/step5-elapsed-not-started (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-elapsed-not-started
- 依存: なし
- 受け入れ基準: Step5でビルド未開始時は総経過時間/ステージ経過時間に「-」が表示される／開始後は従来どおり時間表示される／進捗やステータス判定に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`
- ロールバック手順: 未開始時の経過時間表示差分を revert する
- チェックリスト:
  - ビルド未開始の判定を追加する
  - 経過時間表示を「-」へ切り替える
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 12:55 JST Step5の未開始時に経過時間を「-」表示へ切替する対応に着手。
  - update: 2026-01-22 13:10 JST buildStatus が idle の場合は総/ステージ経過時間を「-」表示に変更。
  - done: 2026-01-22 13:15 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-20 17:53 JST 未開始時に0時間00分00秒が残るため再修正に着手。
  - update: 2026-01-20 17:55 JST 経過時間が0の場合も「-」表示に切替。
  - done: 2026-01-20 17:55 JST pnpm typecheck exit 0 を確認。

2279) fix/shape/vt-stage-crash-logging (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-stage-crash-logging
- 依存: なし
- 受け入れ基準: vtステージ開始〜失敗までの主要区間に詳細ログが追加される／ログから落ちる地点と入力条件が特定できる／処理フローやエラーハンドリングの挙動を変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - vtステージの主要区間にログを追加する
  - 例外発生時に入力条件/タスク情報が出力される
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 13:30 JST vtステージのクラッシュ原因特定のための詳細ログ追加に着手。
  - update: 2026-01-22 13:50 JST vtタスクの開始/完了/失敗とタイル生成失敗箇所の詳細ログを追加。
  - done: 2026-01-22 13:55 JST pnpm typecheck exit 0 を確認。

2280) fix/shape/step5-autostart-from-info-panel (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-autostart-from-info-panel
- 依存: なし
- 受け入れ基準: TreeNodeInfoPanelの「ビルド」ボタン経由でStep5を開いた直後にビルドが自動開始される／手動開始や再開の挙動は維持される／他の遷移に影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/tree/usePluginDialogRoute.ts`（必要に応じて追加）
- ロールバック手順: autoResumeBuild のセット処理を revert する
- チェックリスト:
  - build=1 経路で autoResumeBuild を設定する
  - Step5が自動開始されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 14:05 JST TreeNodeInfoPanel経由でStep5を開いた際に自動開始する対応に着手。
  - update: 2026-01-22 14:20 JST build=1 の場合に autoResumeBuild をセットし、shape のStep5自動開始を誘発。
  - done: 2026-01-22 14:25 JST pnpm typecheck exit 0 を確認。

2281) fix/shape/vt-input-stats-zero (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-input-stats-zero
- 依存: なし
- 受け入れ基準: vt進捗メッセージのinput集計が0になる原因を修正する／必要な入力集計（features/vertices/bytes）が正しく反映される／既存のタイル生成フローを変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: input集計ロジックの差分を revert する
- チェックリスト:
  - typed array座標に対応したbbox/vertex集計を追加する
  - input集計が0にならないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 14:40 JST vt進捗のinput集計が0になる問題の修正に着手。
  - update: 2026-01-22 15:10 JST typed array座標のbbox/vertex集計対応を追加し、typecheck再実行待ち。
  - update: 2026-01-22 15:25 JST typed array判定の型エラーを解消し、input集計ロジックを安定化。
  - done: 2026-01-22 15:30 JST pnpm typecheck exit 0 を確認。

2282) fix/shape/vt-stage-ui-crash-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-stage-ui-crash-diagnostics
- 依存: なし
- 受け入れ基準: transform→vt遷移で二重実行が発生しない／vt進捗がUIへ反映される／クラッシュ直前までの詳細ログが取得できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ/制御の差分を revert する
- チェックリスト:
  - vt開始/完了/失敗の重複実行有無を検出できるログを追加する
  - transform完了→vt開始の境界で状態更新を追跡する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 16:00 JST vt進捗未反映とChromeクラッシュの診断強化に着手。
    - update: 2026-01-22 16:20 JST start/resumeの二重起動ガードとpipeline runIdのログを追加。
    - done: 2026-01-22 16:25 JST pnpm typecheck exit 0 を確認。

2283) fix/shape/vt-resume-crash-task-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-resume-crash-task-diagnostics
- 依存: なし
- 受け入れ基準: vt再開時にタスク単位の入力情報と直前キュー状況がログに出る／クラッシュ直前のタスクを特定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/services/vt/**`（必要に応じて追加）
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - vtタスク開始前にbuffer数/bytes/taskId/tileIdをログ出力する
  - vt開始時にキューの状態サマリをログ出力する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 16:40 JST vt再開時のクラッシュ診断ログ追加に着手。
    - update: 2026-01-22 17:05 JST vt再開時のキューサマリとタスク入力バッファbytesをログ追加。
    - done: 2026-01-22 17:10 JST pnpm typecheck exit 0 を確認。

2284) fix/shape/auto-resume-double-start (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/auto-resume-double-start
- 依存: なし
- 受け入れ基準: 手動クリック時にautoResumeが再発火しない／startBatchProcessが1回のみ実行される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: autoResumeの制御差分を revert する
- チェックリスト:
  - 手動クリック時のautoResume書き込みを見直す
  - 二重起動を防ぐガードを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 17:30 JST 手動クリックとautoResumeの二重起動を抑止する対応に着手。
    - update: 2026-01-22 17:45 JST 手動クリック時のautoResume書き込みを削除し二重起動を抑止。
    - done: 2026-01-22 17:50 JST pnpm typecheck exit 0 を確認。

2285) fix/shape/vt-log-json-stringify (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-log-json-stringify
- 依存: なし
- 受け入れ基準: vt関連ログがJSON.stringifyで出力され省略されない／ブラウザクラッシュ時でもログ内容が欠落しにくい／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/services/vt/**`（必要に応じて追加）
- ロールバック手順: JSON.stringifyログ差分を revert する
- チェックリスト:
  - vt/pipelineの主要ログをJSON.stringify出力へ置換する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 18:10 JST vtログをJSON.stringify形式へ変更する対応に着手。
    - update: 2026-01-22 18:30 JST vt/pipelineの主要ログをJSON.stringify形式へ置換。
    - done: 2026-01-22 18:35 JST pnpm typecheck exit 0 を確認。

2286) fix/shape/vt-index-tiling-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-index-tiling-diagnostics
- 依存: なし
- 受け入れ基準: buildLayerIndexes/タイル生成の前後ログがJSONで出る／例外時にstageが特定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`
- ロールバック手順: 追加ログ差分を revert する
- チェックリスト:
  - buildLayerIndexesの開始/終了ログを追加する
  - タイル生成ループ開始ログを追加する
  - 例外時のstageログを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
  - 運用ログ：
    - start: 2026-01-22 18:55 JST vt index/tiling診断ログ追加に着手。
    - update: 2026-01-22 19:15 JST index/tiling開始終了ログとstage情報をJSON出力に追加。
    - done: 2026-01-22 19:20 JST pnpm typecheck exit 0 を確認。

2287) fix/shape/step4-cache-delete-explanations (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step4-cache-delete-explanations
- 依存: なし
- 受け入れ基準: Step4の各削除ボタンが削除対象を説明する／buildFetchキャッシュ削除の件数表示と削除が動作する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/services/utils/**`（必要に応じて追加）
- ロールバック手順: Step4の説明文と削除判定の差分を revert する
- チェックリスト:
  - Step4のボタンラベル/説明/件数表示を確認する
  - buildFetchキャッシュ削除の件数算出/削除処理を確認し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:40 JST Step4の削除ボタン説明とbuildFetchキャッシュ削除の不具合修正に着手。

2288) fix/shape/step5-task-summary-format (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-task-summary-format
- 依存: なし
- 受け入れ基準: fetch/transform/vt のタスク表示が統一形式に更新される／vt は ADM レベル別 feature 数とタイル枚数が表示される／表示のみ変更で処理結果は変えない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `packages/vt-orchestrator/src/vt/vtStage.ts`, `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: 表示フォーマット変更差分を revert する
- チェックリスト:
  - fetch/transform の表示を「features/polygons/vertices: input -> output (rate)」形式に揃える
  - vt の表示を ADM レベル別 feature 数 + tiles 生成数表示に変更する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:15 JST Step5のタスク表示書式統一とvt集計表示の対応に着手。
  - update: 2026-01-22 20:35 JST fetch/transformの表示書式を統一し、vtのADM別features/tiles集計表示へ変更。
  - update: 2026-01-22 20:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck ともに exit 0 を確認。
  - update: 2026-01-22 22:15 JST vt完了時のメッセージをADM別features+tiles集計に統一し、タスク一覧に残るよう修正。
  - update: 2026-01-22 22:16 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-22 22:30 JST vtタスクで親タイルと交差しない場合の診断ログとメッセージ表記を追加。
  - update: 2026-01-22 22:31 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 01:10 JST vtのskipped:no layers発生時に理由/集計の表示と診断ログ強化の対応に着手。
  - update: 2026-01-23 01:40 JST vtのskipped:no layers時に理由/集計を出す表示と診断ログを追加。
  - update: 2026-01-23 01:41 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 02:10 JST vt extent/tolerance見直し（extent=4096, tolerance=0/1）対応に着手。
  - update: 2026-01-23 02:15 JST vt extent=4096/tolerance=0 を反映。pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 02:30 JST transformの転置インデックスとvtの交差タイル検証ログ追加に着手。
  - update: 2026-01-23 02:40 JST transformのtileId列挙/関係テーブルのログとvtの生成0タイル警告を追加。pnpm --filter @hierarchidb/vt-orchestrator typecheck が exit 0。
  - update: 2026-01-23 03:30 JST vt完了時のタイルサマリが初期値のままになるため、完了時に最新タイル数を再計算して表示する修正に着手。
  - update: 2026-01-23 03:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2289) refactor/shape/download-taskid-format (P1) — 進行中 (2026-01-22)
- ブランチ名: refactor/shape/download-taskid-format
- 依存: なし
- 受け入れ基準: downloadタスクのtaskIdが `nodeId:download:ISO2:adminLevel` 形式になる／参照・更新・削除が新形式で動作する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/services/batch/strategies/**`, `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`（必要に応じて追加）
- ロールバック手順: taskId生成差分を revert する
- チェックリスト:
  - downloadタスクのtaskId生成を新形式へ変更する
  - 参照・更新・削除が新形式に一致するよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:20 JST downloadタスクID形式の統一対応に着手。
  - update: 2026-01-22 20:35 JST downloadタスクIDを nodeId:download:ISO2:adminLevel 形式へ変更。
  - update: 2026-01-22 20:40 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2290) fix/shape/vt-index-memory-aggregation (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-index-memory-aggregation
- 依存: なし
- 受け入れ基準: vtステージでindex構築中のメモリ使用を抑えるためにレイヤー単位で集約し、クラッシュせずに完走する／ログはJSON.stringifyで省略されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: vt集約処理の差分を revert する
- チェックリスト:
  - vt indexをレイヤー単位で集約する
  - JSON.stringifyログで詳細を確認できるようにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 19:45 JST vt index構築のメモリ集約方式でクラッシュを抑止する対応に着手。
  - update: 2026-01-22 20:05 JST vt layer indexをレイヤー単位で集約し、ログをJSON.stringify化。
  - update: 2026-01-22 20:20 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 20:40 JST 高頂点数レイヤーでper-feature indexへ切替し、メモリピークを抑制。
  - blocked: 2026-01-22 20:45 JST pnpm typecheck が vtStage.ts の型エラーで失敗。
  - update: 2026-01-22 20:50 JST 型エラーを修正し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:00 JST per-feature index をズームごとに分割して構築し、ピークメモリを抑える。
  - update: 2026-01-22 21:05 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:20 JST タイルbboxでfeatureをclipしてgeojson-vtを1タイル単位に限定。
  - blocked: 2026-01-22 21:25 JST pnpm typecheck が turf bboxClip の型制約で失敗。
  - update: 2026-01-22 21:30 JST Point/MultiPoint のbbox判定を型安全に修正。
  - update: 2026-01-22 21:35 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 21:45 JST band zMin>=3 のタスクを強制per-tile indexへ切替。
  - update: 2026-01-22 21:50 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 22:05 JST vtタスクのクラッシュ継続のためログ解析と追加対策の検討を開始。
  - update: 2026-01-22 22:25 JST band zMin>=3 を複数レイヤーでもper-tile index化し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 22:40 JST vt完走後の最大更新深度警告を再現し、metadataポーリングの依存関係を安定化。
  - update: 2026-01-22 22:55 JST useVectorTilePreviewMetadata の loadRows 依存をref化し、pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 23:05 JST metadata state更新を差分時のみ行うようガードを追加。
  - update: 2026-01-22 23:15 JST feature一覧のloading表示を初回のみとし、featureIdでの重複行を抑止。
  - update: 2026-01-22 23:25 JST skippedタスクのログをinfoに切り替え、スタック出力を抑制。

2290) fix/shape/vt-resume-mark-running-aborted (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-resume-mark-running-aborted
- 依存: なし
- 受け入れ基準: vtのresume時にrunningタスクが failed（aborted）へ遷移する／vt以外のステージは影響しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/compareTaskOrder.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: vt resume時のrunning→failed差分を revert する
- チェックリスト:
  - vt resume時にrunningタスクをfailedへ更新する
  - vt以外のステージに影響しないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST vt resume時にrunningタスクをaborted扱いへ移行する対応に着手。
  - update: 2026-01-22 21:20 JST vtのみresume時にrunningタスクをfailed(aborted)へ移行する方針で実装準備。
  - update: 2026-01-22 21:30 JST vt resume時にrunningタスクをfailed(aborted)へ移行する処理を追加。
  - update: 2026-01-22 21:32 JST pnpm --filter @hierarchidb/vt-orchestrator build/typecheck、@hierarchidb/shape-plugin typecheck が exit 0（tsdownのdefine警告あり）。
  - update: 2026-01-22 22:05 JST vt完了後にqueued/runningが残る場合、failed(aborted)へまとめて遷移する処理を追加。
  - update: 2026-01-22 22:06 JST pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0。

2291) fix/shape/vt-outline-diagnostics (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/vt-outline-diagnostics
- 依存: なし
- 受け入れ基準: LineString境界の診断ログが追加される／geojson-vt入力前に不正形状が検知されればvtを失敗させる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: 境界診断/検証の差分を revert する
- チェックリスト:
  - boundary LineString生成元の検証を追加する
  - vt直前のgeojson検証で不正形状を失敗扱いにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST アウトライン復帰に向けた境界診断とvt入力検証の対応に着手。
  - update: 2026-01-22 21:20 JST 段階復帰プランの第1段としてvt実行前検証/診断追加で進行。
  - update: 2026-01-22 21:40 JST boundary診断ログとgeojson検証の強化対応に着手。
  - update: 2026-01-22 21:45 JST boundary診断ログを追加し、geojson検証ログにgeometryType/vertexCountを付与。
  - update: 2026-01-22 21:46 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck / @hierarchidb/shape-plugin typecheck が exit 0。
  - update: 2026-01-22 21:55 JST geoboundariesの大陸判定はISO3166を正とし、ログのサンプルはiso2優先で出力するよう修正。
  - update: 2026-01-22 21:56 JST pnpm --filter @hierarchidb/shape-plugin typecheck が exit 0。

2292) feat/shape/vt-dynamic-concurrency (P1) — 進行中 (2026-01-22)
- ブランチ名: feat/shape/vt-dynamic-concurrency
- 依存: なし
- 受け入れ基準: vt並列度がJSヒープ残量に応じて増減する／最小/最大と閾値が設定できる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/compareTaskOrder.ts`, `packages/vt-orchestrator/src/vt/**`, `plugins/shape-plugin/src/common/types/**`（必要に応じて追加）
- ロールバック手順: 動的並列度制御の差分を revert する
- チェックリスト:
  - ヒープ使用率に応じた並列度調整を追加する
  - 設定値（min/max/閾値）を設定可能にする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:55 JST vtの動的並列度制御の対応に着手。
  - update: 2026-01-22 21:20 JST min=1/max=Step4設定/閾値0.85-0.60/1ずつ増減の仕様で実装準備。
  - update: 2026-01-22 21:30 JST vtの動的並列度制御を追加し、vtConfigへdynamicConcurrencyを追加。
  - update: 2026-01-22 21:32 JST pnpm --filter @hierarchidb/gis-sdk build/typecheck が exit 0（tsdownのdefine警告あり）。

2293) fix/map/feature-highlight-source-layer (P1) — 進行中 (2026-01-20)
- ブランチ名: fix/map/feature-highlight-source-layer
- 依存: なし
- 受け入れ基準: MapLibreのsetFeatureStateでvector sourceにsourceLayerが必ず指定される／useMapFeatureHighlightsでsourceLayer欠落があってもエラーが出ない／既存のハイライト挙動が変わらない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/preview/useMapFeatureHighlights.ts`, `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: sourceLayer補完/ガード差分を revert する
- チェックリスト:
  - sourceLayerの取得/補完経路を特定する
  - set/removeFeatureStateにsourceLayerを渡す
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-20 22:02 JST MapLibre setFeatureState の sourceLayer 必須エラー対応に着手。
  - update: 2026-01-20 22:05 JST useMapFeatureHighlights で vector source 判定と sourceLayer 補完/ガードを追加。
  - update: 2026-01-20 22:06 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。手動検証は未実施。

2294) fix/shape/vt-running-stuck-ui (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/vt-running-stuck-ui
- 依存: なし
- 受け入れ基準: vtタスク完了後にUIへ完了状態が反映されRunningが残らない／skipped/completeの最終タスク状態がUIに反映される／進捗通知の仕様を崩さない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`, `packages/features/batch/src/**`, `plugins/shape-plugin/src/ui/hooks/progress/**`（調査後に確定）
- ロールバック手順: vt完了通知/進捗更新の差分を revert する
- チェックリスト:
  - vt完了時のタスク状態更新がUIへ伝播しているか確認する
  - Runningが残る条件を特定し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:05 JST vt完了後もUIにRunningが残る問題の調査に着手。
  - update: 2026-01-21 08:12 JST useShapeBuildTasks にリクエスト世代管理を追加し、古い取得結果でRunningが上書きされるのを防止。
  - update: 2026-01-21 08:14 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。

2295) fix/shape/geoboundaries-metadata-normalize (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/geoboundaries-metadata-normalize
- 依存: なし
- 受け入れ基準: geoBoundaries の国メタデータ生成で countryName/countryCode/adminLevel が正規化される／JPN/ADM0 が Japan/JP/ADM0 として保存される／他データソースの国メタデータ生成に副作用がない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`（調査後に確定）
- ロールバック手順: 正規化ロジックの差分を revert する
- チェックリスト:
  - geoBoundaries の国メタデータ生成箇所を特定する
  - countryName/countryCode/adminLevel の正規化を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:18 JST geoBoundaries の国メタデータ正規化不備の修正に着手。
  - update: 2026-01-21 08:22 JST __hdbOriginKey と国メタデータで countryCode/countryName/adminLevel を正規化する処理を追加。
  - update: 2026-01-21 08:23 JST pnpm typecheck exit 0（tsdownのdefine警告あり）。手動検証は未実施。

2296) feat/shape/metadata-aggregate-hover (P1) — 進行中 (2026-01-21)
- ブランチ名: feat/shape/metadata-aggregate-hover
- 依存: なし
- ExecPlan: plans/shape-metadata-aggregate-hover-execplan.md
- 受け入れ基準: geoBoundaries ADM1 のメタデータ一覧が同一自治体で1行に集約表示される（島・飛地も同一自治体で集約）／集約は表示のみでID統合はしない／ホバー/選択でフィーチャー単体だけでなく同一自治体/同一国の単位で強調できる／影響範囲とロールバック手順を明記する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/map/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 集約表示/ホバー拡張の差分を revert する
- チェックリスト:
  - メタデータ一覧の集約対象キー（ADM1単位）を確定する
  - 集約表示ロジックを実装する
  - 同一自治体/同一国のホバー強調経路を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 08:28 JST ADM1集約表示と自治体/国単位のホバー強調対応に着手。
  - update: 2026-01-21 08:28 JST ExecPlan を作成（plans/shape-metadata-aggregate-hover-execplan.md）。
  - update: 2026-01-21 09:12 JST DoD 承認済み。集約表示とホバー強調の実装・検証を再開。
  - update: 2026-01-21 09:36 JST ADM1集約行の作成、一覧IDの統一、自治体/国の階層展開、エラー集約を実装。
  - update: 2026-01-21 09:37 JST pnpm --filter @hierarchidb/ui-map build exit 0（tsdown define 警告あり、dist 型更新）。
  - update: 2026-01-21 09:39 JST pnpm typecheck exit 0（tsdown define 警告あり）。手動検証は未実施。

2272) fix/shape/step3-index-scroll-not-moving (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-not-moving
- 依存: なし
- 受け入れ基準: Step3のIndexクリックで必ずスクロールが発生する／目的行が画面内の適切な位置に来る／ジャンプではなく短時間の滑らかな移動になる／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`（必要に応じて追加）
- ロールバック手順: Indexクリック時のカスタムスクロール処理差分を revert する
- チェックリスト:
  - Indexクリック時に確実にスクロールが発生するよう修正する
  - スクロール位置の補正を維持する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 08:55 JST Step3のIndexクリックでスクロールしない問題の修正に着手。
  - update: 2026-01-22 09:05 JST ターゲット位置取得を次フレームに遅延し、未移動時は通常のスムーズスクロールへフォールバック。
  - done: 2026-01-22 09:10 JST pnpm typecheck exit 0 を確認。

2271) fix/shape/step3-index-offset-step5-next (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-index-offset-step5-next
- 依存: なし
- 受け入れ基準: Step3のIndexクリック時スクロール位置のズレが解消される／Fetchキャッシュ削除後にStep5の「次へ」が不適切に無効化されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`（必要に応じて追加）
- ロールバック手順: スクロール/削除後のセッションリセット差分を revert する
- チェックリスト:
  - Indexクリック時スクロールの位置補正を行う
  - Fetchキャッシュ削除後のセッションリセット条件を見直す
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 04:05 JST Step3のIndex位置ズレとFetch削除後の次へ無効化の修正に着手。
  - update: 2026-01-22 04:20 JST Indexスクロールのターゲット位置をVirtuoso算出に合わせて補正し、Fetch削除時のセッションリセット条件を出力有無で切替。
  - done: 2026-01-22 04:25 JST pnpm typecheck exit 0 を確認。

2273) fix/shape/step5-next-disabled-after-step4 (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-next-disabled-after-step4
- 依存: なし
- 受け入れ基準: Step4完了後にStep5の「次へ」が適切に有効化される／Fetchキャッシュ削除を行ってもStep5が進める／既存のフェーズ制御を崩さない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（必要に応じて追加）
- ロールバック手順: Step5の「次へ」有効化条件の差分を revert する
- チェックリスト:
  - Step5の有効化条件を調査し、Step4完了後に進めない原因を特定する
  - 必要な有効化条件を追加/修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 09:20 JST Step4完了後にStep5の「次へ」が無効なままになる問題の修正に着手。
  - update: 2026-01-22 09:30 JST プレビュー可否判定に feature metadata を追加し、metadata保存状態でも次へ判定が通るよう調整。
  - done: 2026-01-22 09:35 JST pnpm typecheck exit 0 を確認。

2274) fix/shape/step3-selection-lost-on-step-change (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-selection-lost-on-step-change
- 依存: なし
- 受け入れ基準: Step3の選択内容がStep3以外へ遷移しても保持される／Step3に戻ったとき選択が復元される／Step4/Step5の有効化判定が崩れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/**`（必要に応じて追加）
- ロールバック手順: 選択保持の差分を revert する
- チェックリスト:
  - Step3の選択データが遷移時に失われる原因を特定する
  - 選択保持の修正を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 09:45 JST Step3の選択内容が遷移時に消える問題の修正に着手。
  - update: 2026-01-22 09:55 JST Stepアダプタの最新データ保持をマージ方式に変更し、遷移時に選択が落ちないよう調整。
  - done: 2026-01-22 10:00 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 10:20 JST Draft更新を部分マージに変更し、他ステップの更新で選択が欠落しないよう調整。
  - done: 2026-01-22 10:25 JST pnpm typecheck exit 0 を確認。
  - update: 2026-01-22 10:45 JST ステップ遷移時の save-draft に localDraftData を使用し、遷移直後の空状態を回避。
  - done: 2026-01-22 10:50 JST pnpm typecheck exit 0 を確認。

2275) fix/shape/step3-validation-disabled (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step3-validation-disabled
- 依存: なし
- 受け入れ基準: Step3のバリデーション（次へ/ステップ完了）が選択に応じて正しく有効化される／選択保持が崩れない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`（必要に応じて追加）
- ロールバック手順: Draft同期の差分を revert する
- チェックリスト:
  - 遷移時に最新選択が draft へ反映される経路を確認する
  - Draft同期の更新タイミングを補正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 11:05 JST Step3のバリデーションが無効になる問題の修正に着手。
  - update: 2026-01-22 11:20 JST localDraftData の最新値を遷移/更新時に参照できるよう ref 化する方針で対応予定。
  - update: 2026-01-22 11:30 JST localDraftData を ref 同期し、遷移時の保存に最新値を使用するよう調整。
  - done: 2026-01-22 11:35 JST pnpm typecheck exit 0 を確認。

2270) fix/shape/step4-fetch-cache-enable (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step4-fetch-cache-enable
- 依存: なし
- 受け入れ基準: Step3の国選択のみでStep4の「Fetchキャッシュを削除」が有効化されない／Fetchキャッシュ削除後にStep5の「次へ」が不適切に無効化されない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて追加）
- ロールバック手順: Fetchキャッシュ判定/削除の差分を revert する
- チェックリスト:
  - Fetchキャッシュのカウント対象を raw data に限定する
  - Fetchキャッシュ削除時に raw data のみ削除されるよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 03:05 JST Step4のFetchキャッシュ削除ボタン有効化と次へ無効化の原因調査/修正に着手。
  - update: 2026-01-22 03:20 JST Fetchキャッシュのカウント対象を raw data に限定し、削除時に raw data のみ削除するよう調整。
  - done: 2026-01-22 03:25 JST pnpm typecheck exit 0 を確認。

2269) fix/shape/step3-index-scroll-smooth-fast (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-smooth-fast
- 依存: なし
- 受け入れ基準: Step3 のIndexクリックがジャンプせず短時間で滑らかに移動する／目的位置への移動挙動は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/country-select/src/components/CountryMatrixSelector.tsx`, `plugins/shape-plugin/src/ui/components/step3/ShapeCountrySelectionStep.tsx`
- ロールバック手順: Indexクリック時スクロールのカスタム処理を revert する
- チェックリスト:
  - Indexクリック時のスクロール速度/挙動を調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 02:10 JST Step3 のIndexクリック時スクロールを滑らかに高速化する対応に着手。
  - blocked: 2026-01-22 02:20 JST pnpm typecheck が ui-country-select の dist へ反映されておらず indexScrollDurationMs 未定義で失敗。
  - update: 2026-01-22 02:25 JST pnpm --filter @hierarchidb/ui-country-select build を実行し dist を更新。
  - done: 2026-01-22 02:30 JST pnpm typecheck exit 0 を確認。

2268) fix/shape/step3-index-scroll-speed (P1) — 完了 (2026-01-22)
- ブランチ名: fix/shape/step3-index-scroll-speed
- 依存: なし
- 受け入れ基準: Step3 のIndex(A/B/C...)クリック時スクロールが体感で明確に速くなる／目的位置への移動挙動は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/**`（必要に応じて追加）
- ロールバック手順: スクロール速度変更差分を revert する
- チェックリスト:
  - Step3のIndexクリック時スクロール速度を調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 01:40 JST Step3 のIndexクリック時スクロール速度調整に着手。
  - update: 2026-01-22 01:45 JST Step3 のIndexクリック時スクロール挙動を高速化。
  - done: 2026-01-22 01:50 JST pnpm typecheck exit 0 を確認。

2267) fix/shape/transform-simplify-only-default (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/transform-simplify-only-default
- 依存: なし
- 受け入れ基準: transform のデフォルトが simplify-only になる／フル処理は設定で選択可能な状態で残る／fetch ステージでフィーチャー単位メタデータを生成し空結果も記録する／空結果は transform タスクを生成しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/services/vt/**`, `plugins/shape-plugin/src/common/types/constants.ts`（必要に応じて追加）
- ロールバック手順: 追加した transformMode と fetch メタデータ生成を revert する
- チェックリスト:
  - transformMode を追加し既定を simplify-only にする
  - simplify-only の処理分岐を実装しフル処理を残す
  - fetch ステージでフィーチャー単位メタデータを生成する
  - 空結果時に transform タスクを作らない
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 22:10 JST transform のデフォルトを simplify-only にする変更と fetch メタデータ生成に着手。
  - start: 2026-01-22 02:40 JST fetch/transform のタスクメッセージに削減量を反映する対応に着手。
  - update: 2026-01-22 03:10 JST fetch/transform のメッセージにポリゴン/頂点の削減量を表示し、fetch キャッシュに入力カウントを保存。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-22 03:30 JST fetch フィルタ削減の計測と transform の簡略化効果が反映されるカウント見直しに着手。
  - update: 2026-01-22 04:15 JST fetch でズーム帯フィルタを適用し削減量を表示、transform の簡略化カウントを簡略化出力基準へ切替。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-22 04:35 JST fetch/transform の reduced 表記を差分から百分率に変更する対応に着手。
  - update: 2026-01-22 04:50 JST reduced 表記を百分率へ変更。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 05:05 JST Step遷移の永続化とVTタスク構成/表示の見直し、VT進捗メッセージ改善に着手。
- update: 2026-01-22 05:30 JST Step遷移の永続化・VTタスク構成/表示/進捗メッセージの修正対応を進行中。
- update: 2026-01-22 06:05 JST Step遷移の永続化とVTタスク構成/進捗表示の修正を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:25 JST VTバンドのz範囲上限を最終バンド以外で1段階下げ、タイル総数とz範囲の整合を修正。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:40 JST Step4のfetchキャッシュ削除件数がnodeId単位になるようカウント経路を修正。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 06:50 JST Step4のfetchキャッシュ削除件数表示の修正後にpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:05 JST Step4のfetchキャッシュ削除時にfetchタスクを一覧から除外する処理を追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:15 JST Step4のfetch削除後にタスク一覧も即時反映されることを確認するためpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:40 JST Step3で国選択が変わった場合にfetch/transform/vtのキャッシュとタスクを無効化し、再開が旧選択にならないよう対応。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 07:55 JST 国選択変更時の無効化対応後にpnpm typecheckを再実行（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 08:25 JST 国選択差分削除の前提として transform cache の国/ADMメタデータ格納経路を確認する調査に着手。
- update: 2026-01-22 08:40 JST transform cache の country/admin は fetch→transform の正規経路では必ず設定されることを確認（詳細は回答）。追加のコード変更なし。
- start: 2026-01-22 09:00 JST vt再開ログの原因確認とresume時の挙動整理に着手。
- update: 2026-01-22 09:15 JST resume時はmetadata取得とfetch/transform/vtのstage起動を行うが、runStageTasksはqueuedのみ処理するため再実行は発生しない挙動を確認。resume時にmetadataロードを省略する最適化は未対応。
- update: 2026-01-22 09:30 JST resume時のmetadata読み込みをfetch/transformのタスク生成が必要な場合のみ行うよう修正。
- update: 2026-01-22 09:40 JST resume時のmetadata読み込み最適化を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- start: 2026-01-22 10:10 JST vtステージでのDexie Transaction committed too earlyの原因調査に着手。
- update: 2026-01-22 10:25 JST vtのcollectFeaturesでDexieトランザクション内の長時間処理を避けるため一括取得へ変更。
- update: 2026-01-22 10:35 JST vtのcollectFeatures修正を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 11:05 JST vtクラッシュはglobalタイル(0/0/0)で222バッファを一括デコードしgeojson-vtの全量インデックス化を行うことが原因候補と判断。回避策の検討に移行。
- start: 2026-01-22 11:20 JST vt 0/0/0タイルをcontinent単位に分割してインデックス化・結合する対応に着手。
- update: 2026-01-22 11:55 JST 0/0/0タイルでcontinent単位の分割インデックス化とタイル結合を実装。
- update: 2026-01-22 12:10 JST continent分割のvt対応を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
- update: 2026-01-22 12:35 JST 0/0/0でcontinentごとにインデックスを逐次作成しタイル単位で集約する方式へ変更。
- update: 2026-01-22 12:45 JST continent逐次集約方式を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-21 23:05 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig で transformMode 未定義エラーにより失敗。
  - update: 2026-01-21 23:07 JST pnpm --filter @hierarchidb/gis-sdk build を実行して dist 型定義を更新。
  - update: 2026-01-21 23:12 JST shapePipeline の未使用 import 修正と simplify-only の診断処理を整理。
  - done: 2026-01-21 23:20 JST simplify-only デフォルト化と fetch メタデータ生成/空結果スキップを反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-21 23:55 JST shapeVtPipeline を shapePipeline に改名し参照を更新。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-22 00:30 JST autoResumeBuild を build 開始前に保存し、Step5 復帰時の自動開始を追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-22 00:55 JST autoResumeBuild の自動開始時は localStorage を再設定しないよう修正し無限ループを回避。
  - update: 2026-01-22 01:20 JST vt タイルの input 統計を buffer 反映の bbox で集計するよう修正し input=0 を回避。
  - update: 2026-01-22 00:15 JST build 開始前に autoResumeBuild を保存し、Step5 復帰時に一致すれば自動開始する処理を追加。

2266) analysis/shape/transform-mode-default (P1) — 進行中 (2026-01-21)
- ブランチ名: analysis/shape/transform-mode-default
- 依存: なし
- 受け入れ基準: transform の処理モード/デフォルト設定の所在と影響範囲が整理される／「simplifyのみ」を既定にした場合のリスク/代替案を提示する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/common/types/constants.ts`, `packages/vt-orchestrator/src/transform/**`（調査結果に応じて追加）
- ロールバック手順: 影響なし（分析のみ）
- チェックリスト:
  - transform 処理手順と設定項目を整理する
  - デフォルト変更の影響と代替案を提示する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-21 21:20 JST transform 処理モードのデフォルト検討を開始。
  - done: 2026-01-21 21:35 JST 現行設定/処理手順を整理し、simplify-only 既定化の影響と代替案を提示。

2265) fix/vt/tile-metrics-message (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/vt/tile-metrics-message
- 依存: なし
- 受け入れ基準: vt タスクが z/x/y ごとに入力FGB合計サイズ・feature/polygon/lineString/vertex 合計と、geojson-vt 後の tile 合計を message へ出力する／ポリゴン数は外環カウントで集計する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/**`（必要に応じて追加）
- ロールバック手順: vt タスクのメッセージ生成差分を revert する
- チェックリスト:
  - z/x/y タイル単位の入力/出力メトリクスを算出する
  - vt タスクの message にタイル単位のメトリクスを反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 20:40 JST vt タイル単位メトリクスをメッセージに表示する対応に着手。
  - blocked: 2026-01-21 20:50 JST pnpm typecheck が vtStage の型エラーで失敗。
  - update: 2026-01-21 21:00 JST vt タイル単位の入力/出力メトリクス集計とメッセージ更新を実装。
  - done: 2026-01-21 21:05 JST vt タイル単位メトリクスの message 表示を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。

2264) fix/shape/feature-metadata-stage-counters (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/feature-metadata-stage-counters
- 依存: なし
- 受け入れ基準: フィーチャー単位のメタデータに fetch/transform/vt の段階別ポリゴン数・頂点数が記録される／不足しているカラムや生成フローが見直される／Step6 の表示に必要な値が欠落しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/**`（必要に応じて追加）
- ロールバック手順: 追加したメタデータカラムと生成処理を revert する
- チェックリスト:
  - 既存スキーマの不足点を特定する
  - フィーチャー単位の段階別カウントを保存できるよう再編する
  - 生成フローを更新し、Step6 で参照される値を補完する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 19:45 JST フィーチャー単位の段階別メタデータのスキーマ/生成フロー調査に着手。
  - blocked: 2026-01-21 20:05 JST pnpm typecheck が shape-plugin の ShapeFeatureMetadata 型不一致で失敗。
  - update: 2026-01-21 20:15 JST フィーチャー単位の fetch/transform ポリゴン数・頂点数を記録するカラムと生成フローを追加。
  - done: 2026-01-21 20:20 JST フィーチャー単位の段階別メタデータ拡張を反映。検証: pnpm --filter @hierarchidb/plugin-service-api build（exit 0、tsdown define 警告あり）／pnpm typecheck（exit 0）。

2263) fix/shape/step5-prebuild-task-list (P1) — 進行中 (2026-01-21)
- ブランチ名: fix/shape/step5-prebuild-task-list
- 依存: なし
- 受け入れ基準: Step4 のキャッシュ件数が 1 以上のとき Step5 でビルド開始前にタスク一覧が表示される／ビルド開始後は従来どおりタスクを再生成する／No tasks yet が表示されないことを UI で確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査結果に応じて追加）
- ロールバック手順: 該当差分を revert し、Step5 のタスクリスト表示を修正前に戻す
- チェックリスト:
  - Step4 キャッシュ由来の前回タスク一覧を Step5 初期表示に反映する
  - ビルド開始時のタスク再生成フローを維持する
  - UI で No tasks yet が表示されないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-21 09:10 JST Step5 のビルド開始前タスク一覧表示の修正に着手。
  - blocked: 2026-01-21 09:30 JST pnpm typecheck が ShapeBuildTaskSummary の status 型不一致で失敗。
  - blocked: 2026-01-21 09:40 JST pnpm typecheck が WorkerProvider フルフローテストの型エラーで失敗。
  - update: 2026-01-21 09:50 JST Step5 の初期表示でキャッシュ済みタスクを読み込み、status/stage を厳密に解釈して一覧へ反映。
  - update: 2026-01-21 10:00 JST WorkerProvider フルフローテストの型注釈を補正。
  - update: 2026-01-21 10:25 JST タスク履歴が空の場合に fetch/transform/vt キャッシュから擬似タスクを生成して表示。
  - done: 2026-01-21 10:30 JST Step5 のビルド開始前タスク一覧表示を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。

2262) test/shape/full-flow-worker-pipeline (P1) — 進行中 (2026-01-19)
- ブランチ名: test/shape/full-flow-worker-pipeline
- 依存: なし
- 受け入れ基準: shape の fetch/transform/vt を実処理で通す「擬似ではない」フルフローテストが追加されている／Comlink/WorkerProvider 経路を通るフルフローテストが追加され、UI描画なしで JPN ADM0/ADM1 を選択して VT とフィーチャーメタデータ生成を検証できる／実データ取得と永続化を伴うことがテストから判別できる／実行コマンドと実行条件が明記されている／pnpm --filter @hierarchidb/shape-plugin test が exit 0／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/src/**`, `plugins/shape-plugin/vitest.config.ts`, `app/src/**`（必要に応じて追加）
- ロールバック手順: 追加したフルフローテストを削除する
- チェックリスト:
  - 実Worker/実データ/永続化を通すフルフローテストを追加する
  - Comlink/WorkerProvider 経路のフルフローテストを追加する（UI描画なし、JPN ADM0/ADM1）
  - テストの実行条件（環境変数/時間目安）を明記する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 09:22 JST フルフロー非擬似テストの設計と追加に着手。
  - update: 2026-01-19 09:44 JST 非擬似フルフローテストと vt-orchestrator のテスト用 alias を追加。
  - blocked: 2026-01-19 09:44 JST pnpm --filter @hierarchidb/shape-plugin test が DNS 解決失敗 (www.geoboundaries.org, ENOTFOUND) により失敗。
  - blocked: 2026-01-19 09:47 JST DNS 許可後に再実行したが www.geoboundaries.org の ENOTFOUND が継続。
  - update: 2026-01-19 09:47 JST Node の dns.lookup でも ENOTFOUND を確認、nslookup は sandbox 制限で失敗。
  - update: 2026-01-19 09:47 JST geoboundaries.org でも dns.lookup が ENOTFOUND。
  - update: 2026-01-19 10:37 JST フルフローの downloadTaskPayloads を明示指定し、失敗タスクの詳細を出すようテストを調整。
  - blocked: 2026-01-19 10:37 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND のまま失敗。
  - update: 2026-01-19 10:43 JST テストの DB を削除してスキーマ差異を避ける調整と shape-store の test alias を追加。
  - blocked: 2026-01-19 10:43 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (www.geoboundaries.org) のまま失敗。
  - update: 2026-01-19 10:45 JST DB削除タイミングを調整し DatabaseClosedError を回避する修正を実施。
  - blocked: 2026-01-19 10:45 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (www.geoboundaries.org) のまま失敗。
  - update: 2026-01-19 10:51 JST NaturalEarth の download URL を endpoint として渡せるようにし、エラー原因の詳細を出力する修正を追加。
  - blocked: 2026-01-19 10:51 JST pnpm --filter @hierarchidb/shape-plugin test -- --run shape-vt-pipeline.full-flow.headless.test.ts が ENOTFOUND (github.com) のまま失敗。
  - start: 2026-01-20 11:05 JST Comlink/WorkerProvider 経路のフルフローテスト追加に着手。
  - update: 2026-01-20 11:35 JST WorkerProvider 経路のフルフローテストを app 側に追加（JPN ADM0/ADM1、Comlink 経由）。
  - update: 2026-01-20 11:55 JST app の vitest alias に @hierarchidb/vt-orchestrator の src を追加。
  - blocked: 2026-01-20 11:56 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が RequestInit AbortSignal 型不一致で失敗。
  - blocked: 2026-01-20 11:59 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が fetch failed で失敗（ネットワーク到達性）。
  - update: 2026-01-20 14:05 JST WorkerProvider フルフローテストに進捗/失敗の診断ログを追加。
  - update: 2026-01-20 14:15 JST フェッチ失敗時の URL/エラーを出すログを追加。
  - update: 2026-01-20 14:20 JST download payload と startBatchSession 失敗時の詳細ログを追加。
  - update: 2026-01-20 14:25 JST payload 生成時の失敗ログと metadata URL の診断ログを追加。
  - update: 2026-01-20 14:30 JST fetch ラッパを window/global 両方に設定し、同期例外も記録するよう補強。
  - update: 2026-01-20 14:35 JST 失敗ログを stdout 出力に変更して取得しやすく調整。
  - blocked: 2026-01-20 14:40 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (www.geoboundaries.org) で失敗。
  - update: 2026-01-20 15:05 JST WorkerProvider テストで /iso3166-2-level1.csv をローカルCSVから返すための fetch 分岐を追加。
  - blocked: 2026-01-20 18:15 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (geoboundaries.org) で失敗。
  - update: 2026-01-20 19:05 JST WorkerProvider テストの進捗ログに task summary を追加し、最大実行時間を 15 分へ拡張。
  - blocked: 2026-01-20 19:15 JST pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx が getaddrinfo ENOTFOUND (geoboundaries.org) で失敗。
  - update: 2026-01-20 19:35 JST WorkerProvider テストの APP_PREFIX を固定値 (hidb) に揃えて task queue の参照一致を狙う調整を追加。
  - update: 2026-01-20 20:05 JST WorkerProvider テストに task-queue 全件スナップショットの診断ログを追加。
  - update: 2026-01-20 20:25 JST WorkerProvider テストの完了判定をバッチセッション/タスク完了に基づくものへ変更し、status mismatch の診断ログを追加。
  - update: 2026-01-20 20:45 JST WorkerProvider テストの進捗判定から ShapeQuery の processingStatus を外し、task queue の進捗のみで監視するよう変更。
  - update: 2026-01-20 21:05 JST WorkerProvider テストの zoomBandBoundaries を [0, 4] にして transform/vt タスク数を抑制。
  - update: 2026-01-20 21:25 JST WorkerProvider テストの selfIntersectionTuningConfig を緩和して transform の負荷を軽減。
  - update: 2026-01-20 21:45 JST selfIntersectionTuningConfig.disableAtZoomOrBelow を 11 に調整し、検証エラーを回避。
  - update: 2026-01-20 22:05 JST WorkerProvider テストで transform の tolerance と maxVerticesPerFeature を調整し処理時間を短縮。
  - update: 2026-01-20 22:30 JST transform の自己交差修正に metrics ログを追加し、vt ステージ開始/終了時の heap スナップショットを出力するよう調整。
  - update: 2026-01-20 22:55 JST vtConfig.maxConcurrent のデフォルトを 1 に下げてブラウザ VT 生成の負荷を抑制。
  - start: 2026-01-20 23:40 JST vtステージのクラッシュ区間を特定するための詳細計測追加に着手。
  - update: 2026-01-20 23:50 JST vtステージの collect/index/tiling/vtpbf 各区間に heap/duration を出す計測ログを追加。
  - update: 2026-01-20 23:55 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 00:10 JST buildLayerIndexes のレイヤー単位 start/done と feature/vertex/polygon 統計ログを追加。
  - update: 2026-01-21 00:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 00:35 JST admin0 band>=6 の feature サンプル出力と transform tolerance を増やす調整を追加。
  - update: 2026-01-21 00:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 01:10 JST transform の永続化前に GeoJSON 検証を追加し、不正形状をログしてタスク失敗とする処理へ変更。
  - update: 2026-01-21 01:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 01:35 JST admin0 の z<=2 を tolerance=5.0、z>=3 を tolerance=3.0 に切替。
  - update: 2026-01-21 01:40 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 02:00 JST admin0 の z<=2 を tolerance=8.0、z>=3 を tolerance=5.0 に切替。
  - update: 2026-01-21 02:05 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 02:30 JST admin0 の z<=2/z>=3 を tolerance=10.0 に切替。
  - update: 2026-01-21 02:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 03:10 JST admin レベル全体で z<=2/z>=3 の tolerance=10.0 を適用。
  - blocked: 2026-01-21 03:15 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が未使用引数で失敗。
  - update: 2026-01-21 03:20 JST resolveTransformTolerance の引数整理で typecheck 修正。
  - update: 2026-01-21 03:25 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-21 03:45 JST boundaryDisableAtZoomOrAbove を追加し z>=3 の境界生成を抑止できるようにした。
  - update: 2026-01-21 03:55 JST pnpm --filter @hierarchidb/gis-sdk build で d.ts を更新。
  - update: 2026-01-21 04:00 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。

2261) fix/shape/network-tests-node-direct (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/network-tests-node-direct
- 依存: なし
- 受け入れ基準: shape のネットワーク系テストが ENABLE_INTEGRATION_TESTS なしで実行される／Node 環境のテストではCORS-Proxyを使わずデータソースURLへ直接アクセスする／テストの実行条件や説明が実態に合う／pnpm typecheck が通る／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/src/services/utils/__tests__/generateUrlMetadata.unit.test.ts`, `plugins/shape-plugin/src/services/datasources/__tests__/unit/DataSourceIntegration.unit.test.ts`, `plugins/shape-plugin/vitest.setup.ts`（必要に応じて関連ファイルを追記）
- ロールバック手順: テストの実行条件とセットアップ差分を revert する
- チェックリスト:
  - ENABLE_INTEGRATION_TESTS に依存するスキップ条件を撤去する
  - Node テストで CORS-Proxy を使わないことを明示する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 23:50 JST shape のネットワーク系テスト実行条件と Node 直アクセスの修正に着手。
  - done: 2026-01-20 00:10 JST ネットワーク系テストのスキップ撤去と Node 直アクセス設定を反映。検証: pnpm typecheck（exit 0）。

2260) refactor/shape/tests-structure-and-datasource (P1) — 完了 (2026-01-19)
- ブランチ名: refactor/shape/tests-structure-and-datasource
- 依存: なし
- 受け入れ基準: shape テストが `__tests__` 配下に揃えられている／fetch段のテストに geoBoundaries が追加されている／dataSourceName がリテラルunionで制約され正規化/フォールバックが撤去されている／pnpm typecheck が通る／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/**`, `packages/**`
- ロールバック手順: テスト配置と型修正を revert する
- チェックリスト:
  - shape のテスト配置を `__tests__` 配下へ移動する
  - Fetch段テストに geoBoundaries を追加する
  - dataSourceName の正規化/フォールバックを撤去しリテラルunionで制約する
  - 旧ステージ名（download/extract1/extract2/vectortile）のテストを fetch/transform/vt に更新する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 22:10 JST shape テスト配置整理と dataSourceName 型制約の改修に着手。
  - update: 2026-01-19 23:10 JST 旧ステージ名のテストを fetch/transform/vt に合わせる修正に着手。
  - done: 2026-01-19 23:35 JST shape テスト配置と dataSourceName 型制約の改修、fetch/transform/vt へのテスト更新を完了。検証: pnpm typecheck（exit 0）。

2259) doc/shape/build-tests-audit (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-tests-audit
- 依存: なし
- 受け入れ基準: shape ビルド工程のテスト対象と内容が整理されている／実行・未実行の範囲が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plugins/shape-plugin/**`, `packages/**`
- ロールバック手順: 追記した調査記録を削除する
- チェックリスト:
  - shape ビルド関連のテストファイルを特定する
  - 各テストの対象ステージ/検証内容を整理する
  - 実行・未実行の状況を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 21:50 JST shape ビルド工程のテスト調査に着手。
  - done: 2026-01-19 22:05 JST shape ビルド工程のテスト一覧と検証状況を整理。

2260) fix/shape/chunkstore-missing-export (P1) — 完了 (2026-01-20)
- ブランチ名: fix/shape/chunkstore-missing-export
- 依存: なし
- 受け入れ基準: deleteRawDataDataSourceBuffersForNodeKeys が export され app build の MISSING_EXPORT が解消される／pnpm typecheck が exit 0／pnpm --filter @hierarchidb/app build が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts`（必要に応じて）
- ロールバック手順: 追加した export を revert し、元の状態へ戻す
- チェックリスト:
  - deleteRawDataDataSourceBuffersForNodeKeys を実装・export する
  - pnpm typecheck を実行する
  - pnpm --filter @hierarchidb/app build を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 13:20 JST app build の MISSING_EXPORT 解消に着手。
  - blocked: 2026-01-20 01:25 JST pnpm typecheck が useShapeCountrySelectionStep.ts の removedBufferSet 未定義で失敗。
  - update: 2026-01-20 01:32 JST removedBufferSet のスコープ修正を実施。
  - done: 2026-01-20 01:35 JST pnpm typecheck exit 0 と pnpm --filter @hierarchidb/app build exit 0 を確認。

2258) feat/storage/unify-vt-shape-route-location (P1) — 進行中 (2026-01-19)
- ブランチ名: feat/storage/unify-vt-shape-route-location
- 依存: plan/storage/unify-vt-shape-route-location
- 受け入れ基準: VtShapeDb/VtDb 参照がすべて削除され、Ephemeral*DB と各ドメインDBへ移行されている／Step4 の中間生成物削除が各ノード種別で機能する／CoreDB のノード削除で関連データが nodeId で削除される／`pnpm lint && pnpm format && pnpm typecheck && pnpm test` が exit 0／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `packages/vt-shape-store/**`, `packages/vt-store/**`, `packages/features/*-store/**`, `packages/vt-orchestrator/**`, `packages/runtime-worker/**`, `plugins/**`, `config/**`
- ロールバック手順: 旧ストアの参照を復元し、移行差分を revert する
- チェックリスト:
  - VtShapeDb/VtDb 参照箇所を洗い出す
  - Ephemeral*DB/DomainDB への参照置換を実施する
  - Step4 手動削除/自動削除の挙動を確認する
  - CoreDB ノード削除時のアーティファクト削除を確認する
  - pnpm lint && pnpm format && pnpm typecheck && pnpm test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:50 JST VtShapeDb/VtDb 廃止の実装作業に着手。
  - blocked: 2026-01-19 17:30 JST RouteDB/LocationDB へのタイル保存フォーマットと contentHash/featureCount の扱い方針が未確定。
  - update: 2026-01-19 17:45 JST タイル保存フォーマット方針が確定し、shape の移行実装に着手。
  - update: 2026-01-19 18:20 JST VtShapeDb/VtDb 参照削除の続きとして、残りの参照箇所とドキュメント更新を進める。
  - blocked: 2026-01-19 18:35 JST pnpm format が plugin-ui-host/styler-plugin/cors-proxy の既存 lint 指摘で失敗。format 実行により広範囲の未意図差分が発生したため、扱い方針の確認が必要。
  - update: 2026-01-19 19:05 JST pnpm format の差分保持を選択し、pnpm lint/typecheck を再実行してテスト失敗の修正に着手。
  - update: 2026-01-19 21:10 JST pnpm format/lint/typecheck を再実行し成功を確認。
  - blocked: 2026-01-19 21:15 JST pnpm test が 360s でタイムアウト（turbo run test --parallel の完走前に終了）。
  - blocked: 2026-01-19 21:40 JST pnpm test を 120s/240s/360s で再実行したが完走前にタイムアウト。
  - update: 2026-01-20 00:20 JST vt-store/vt-shape-store の残存参照と削除対象の棚卸しを再開。
  - update: 2026-01-20 00:45 JST pnpm lint/format/typecheck を実行し完走（format は警告のみ）。
  - blocked: 2026-01-20 00:50 JST pnpm test が 120s タイムアウト、再実行(240s)で @hierarchidb/batch-session-ports の OOM により失敗。
  - update: 2026-01-19 09:22 JST ターゲット検証として pnpm --filter @hierarchidb/shape-plugin test と pnpm --filter @hierarchidb/runtime-worker test を実行し exit 0 を確認。
  - update: 2026-01-19 10:30 JST 2258 の残存 VtShapeDb/VtDb 参照の再棚卸しと移行差分の確認に着手。
  - blocked: 2026-01-19 10:55 JST pnpm test が shape-plugin の full-flow テストで失敗（geoboundaries へのネットワーク接続で ENOTFOUND）。
  - blocked: 2026-01-19 11:00 JST pnpm test を再実行したが同様に shape-plugin の full-flow テストで ENOTFOUND が発生。
  - blocked: 2026-01-19 11:05 JST NODE_OPTIONS=--dns-result-order=ipv4first で pnpm test を再実行したが ENOTFOUND が継続。
  - blocked: 2026-01-19 11:12 JST Node DNS を setServers で上書きしたが dns.lookup が ENOTFOUND のまま（Node の resolver 経路が別）。
  - blocked: 2026-01-19 11:18 JST pnpm test を再試行したが shape-plugin の full-flow テストで ENOTFOUND が継続。

2257) doc/location/nodeid-cache-confirm (P1) — 完了 (2026-01-19)
- ブランチ名: doc/location/nodeid-cache-confirm
- 依存: なし
- 受け入れ基準: Location の nodeId 単位キャッシュ実装の有無がコード参照で整理されている／未実装の場合は追加方針が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - Location プラグイン/ストアの nodeId キャッシュ利用有無を確認する
  - 結果と方針をドキュメントへ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:45 JST Location の nodeId キャッシュ調査に着手。
  - done: 2026-01-19 17:10 JST Location の nodeId キャッシュ未導入を確認しドキュメントに反映。

2256) doc/vt-pipeline-design-update (P1) — 完了 (2026-01-19)
- ブランチ名: doc/vt-pipeline-design-update
- 依存: なし
- 受け入れ基準: `docs/vt-pipeline-design.md` が新しい保存先方針（Ephemeral*DB/DomainDB）に一致する／VtShapeDb/VtDb 記載が削除されている／中間生成物/ビルド結果の削除条件が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/vt-pipeline-design.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - 保存先の分担とストア構成を更新する
  - 中間生成物とビルド結果の削除条件を追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:45 JST vt パイプライン設計ドキュメントの更新に着手。
  - done: 2026-01-19 17:10 JST vt パイプライン設計ドキュメントを保存先方針に合わせて更新。

2255) plan/storage/unify-vt-shape-route-location (P1) — 完了 (2026-01-19)
- ブランチ名: plan/storage/unify-vt-shape-route-location
- 依存: なし
- ExecPlan: plans/storage-unify-vt-shape-route-location-execplan.md
- 受け入れ基準: VtShapeDb/VtDb 廃止と保存先統合の ExecPlan が作成され、影響範囲・移行手順・検証・ロールバックが明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `plans/**`, `packages/vt-shape-store/**`, `packages/vt-store/**`, `packages/features/shape-store/**`, `packages/runtime-worker/**`, `plugins/**`
- ロールバック手順: ExecPlan の差分を revert する
- チェックリスト:
  - 旧ストアの削除範囲と移行先を明記する
  - ExecPlan に移行手順と検証計画を記述する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:10 JST VtShapeDb/VtDb 廃止と保存先統合の ExecPlan 作成に着手。
  - done: 2026-01-19 16:40 JST ExecPlan を作成し移行方針を整理。

2254) doc/build/fetchwithauth-cache-confirm (P1) — 完了 (2026-01-19)
- ブランチ名: doc/build/fetchwithauth-cache-confirm
- 依存: なし
- 受け入れ基準: fetchWithAuth のキャッシュが nodeId 単位で稼働している根拠をコード参照で整理する／未実装の場合はその旨と要件を明記する／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - fetchWithAuth/smartFetch のキャッシュ経路を確認する
  - nodeId 単位キャッシュの有無を整理する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:05 JST fetchWithAuth キャッシュ稼働確認の調査に着手。
  - done: 2026-01-19 16:20 JST nodeId 単位キャッシュの実装箇所を整理しドキュメントに反映。

2253) doc/build/artifacts-impact-priority (P1) — 完了 (2026-01-19)
- ブランチ名: doc/build/artifacts-impact-priority
- 依存: なし
- 受け入れ基準: 影響ドキュメントの更新方針（軽微/書き直し/削除）と優先順が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/build-artifacts-by-node-type.md`
- ロールバック手順: ドキュメント差分を revert する
- チェックリスト:
  - 影響ドキュメント一覧と方針を整理する
  - 優先順を明記する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 16:00 JST 影響ドキュメント更新方針の整理に着手。
  - done: 2026-01-19 16:20 JST 影響ドキュメントの更新優先順を追記。

2252) doc/shape/build-stage-compare (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-stage-compare
- 依存: なし
- 受け入れ基準: 現行パイプラインと新パイプラインの差分が stage ごとに表形式で整理されている／入力・処理・出力・永続化・メリット/リスクが比較できる／保存先が docs 配下で明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/**`
- ロールバック手順: 追加した比較ドキュメントを削除し、TASKS.md の該当項目を revert する
- チェックリスト:
  - 現行と新フローの差分を stage ごとに整理する
  - 入力/処理/出力/永続化/メリット・リスクの比較表を作成する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 15:30 JST 現行 vs 新パイプラインの比較ドキュメント作成に着手。
  - done: 2026-01-19 15:40 JST 比較ドキュメントを docs に追加。
  - update: 2026-01-19 15:55 JST ノード種別ごとの成果物/保存先仕様ドキュメントを追加。

2251) doc/shape/build-stage-uml (P1) — 完了 (2026-01-19)
- ブランチ名: doc/shape/build-stage-uml
- 依存: なし
- 受け入れ基準: 完成像の fetch/transform/vt データフローが UML で図式化されている／入出力・永続化先・ズーム帯/インデックスの関係が図で判別できる／UML の形式（Mermaid/PlantUML など）と保存先が明記されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 影響範囲: `docs/**` または `plans/**`（保存先決定後に確定）
- ロールバック手順: 追加した UML ドキュメントを削除し、TASKS.md の該当項目を revert する
- チェックリスト:
  - UML の形式と保存先を確定する
  - fetch/transform/vt の入力・出力・永続化・ズーム帯/インデックスの流れを図式化する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 15:00 JST 完成像のデータフロー UML 作成に着手。
  - update: 2026-01-19 15:05 JST UML 形式=Mermaid、保存先=docs の指定を受領。
  - done: 2026-01-19 15:10 JST Mermaid 図を docs に作成し完了。
  - update: 2026-01-19 15:15 JST Mermaid のノード名からカッコ表記を除去。
  - update: 2026-01-19 15:20 JST Mermaid ノード内の括弧を追加で除去。
  - update: 2026-01-19 15:25 JST Mermaid ノード内の矢印表記を "to" に置換。

2250) plan/shape/build-stage-restructure (P1) — 完了 (2026-01-19)
- ブランチ名: plan/shape/build-stage-restructure
- 依存: なし
- ExecPlan: plans/shape-build-stage-restructure-execplan.md
- 受け入れ基準: fetch/transform/vt の新ステージ構成と入出力・永続化・ズーム帯の流れが ExecPlan に明文化されている／既存処理の置換範囲と非互換点が整理されている／既定OFFのフラグ導入方針とロールバック手順が明記されている／検証手順が `pnpm lint && pnpm format && pnpm typecheck && pnpm test` を含めて記載されている／TASKS.md の運用ログに start/done/blocked が記載されている
- 要点: shape ビルドの fetch/transform/vt 再編に向けた ExecPlan を作成し、フラグ既定OFFの移行計画を整理した。
- 影響範囲: `packages/vt-orchestrator/src/**`, `packages/features/shape-store/src/**`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/components/step5/**`（計画で確定）
- ロールバック手順: フラグを既定OFFのまま維持し、該当差分を revert して従来のビルドフローへ戻す
- チェックリスト:
  - 既存の fetch/transform/vt の責務と入出力を整理する
  - 新ステージ構成（fetch=フィルタ+ズーム帯別FG保存、transform=simplify+転置インデックス、vt=タイル化+子孫タイル生成）を ExecPlan に記述する
  - 既定OFFのフラグと適用箇所を提案し、段階導入手順を明記する
  - 受け入れ基準・検証手順・ロールバックを ExecPlan に明文化する
  - TASKS.md の運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 14:20 JST shape ビルドのステージ再編計画（ExecPlan）作成に着手。
  - done: 2026-01-19 14:40 JST ExecPlan を作成し、ステージ再編の計画を整理。

2249) feat/shape/omit-details-config (P1) — 完了 (2026-01-19)
- ブランチ名: feat/shape/omit-details-config
- 依存: なし
- 受け入れ基準: Transform でズームに応じた小BBox/小面積ポリゴン除外が行われる（外形リング面積を使用）／OmitDetailsConfig が BuildConfig に追加され弱/中/強を選べる／デフォルトは強設定／`app/public/templates/population-2023/tree-nodes.json` に設定値が反映される／Step4 Transform のアコーディオンにカードUIが追加される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/common/types/**`, `app/public/templates/population-2023/tree-nodes.json`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、omit-details の設定/UI/フィルタを撤去する
- チェックリスト:
  - OmitDetailsConfig を追加し weak/medium/strong を選べるようにする
  - Transform の簡略化前に bbox/面積でポリゴン省略を適用する
  - デフォルトを strong として適用する
  - Step4 Transform にカードUIを追加する
  - templates に設定値を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 12:10 JST omit-details 設定と Transform 省略フィルタ追加に着手。
  - update: 2026-01-19 12:28 JST omit-details preset(弱/中/強)・Transform フィルタ・Step4 UI・テンプレート更新を実装。
  - blocked: 2026-01-19 12:35 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が omitDetailsConfig 未解決で失敗。
  - done: 2026-01-19 12:37 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 12:38 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 12:39 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 12:55 JST self-intersection tuning（ズーム/頂点数でスキップ）設定を追加し Transform に適用。
  - done: 2026-01-19 13:05 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 13:06 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 13:07 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 13:30 JST Transform タスクの各処理フェーズ開始/終了を task.message に反映し、タスク内進捗の段階化を追加。
  - done: 2026-01-19 13:33 JST pnpm --filter @hierarchidb/gis-sdk build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 13:34 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - done: 2026-01-19 13:35 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 13:45 JST task.message の phase 表示を i18n 化。
  - done: 2026-01-19 13:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-19 11:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2248) feat/ui-shape/build-timing-display (P1) — 完了 (2026-01-19)
- ブランチ名: feat/ui-shape/build-timing-display
- 依存: なし
- 受け入れ基準: 「ビルド操作」カードに総経過時間/ステージ経過時間を表示する（pause 時間は除外）／ステージ残り時間の概算をタスク進捗から算出して表示する／1時間23分45秒形式で表示される／i18n 対応される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`, `packages/components/src/BuildStepPanel.tsx`, `packages/components/src/BuildControlCard.tsx`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、ビルド操作カードから経過時間/残り時間表示を除去する
- チェックリスト:
  - ビルド総経過時間/ステージ経過時間を pause 除外で算出する
  - ステージ残り時間の概算を進捗と残タスクから算出する
  - BuildControlCard に表示枠を追加する
  - i18n キーとフォールバックを追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 11:30 JST ビルド操作カードへ経過時間/残り時間を表示する対応に着手。
  - update: 2026-01-19 11:45 JST BuildControlCard/BuildStepPanel に詳細表示枠を追加し、Step5 で経過時間/残り時間の算出・表示を実装。
  - done: 2026-01-19 11:52 JST pnpm --filter @hierarchidb/components build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-19 11:53 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-19 12:05 JST 経過時間表示を「1時間23分45秒」形式に揃える i18n 調整に着手。
  - done: 2026-01-19 12:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。経過時間表示の i18n 形式を確認。

2247) fix/ui-map/feature-list-column-toggle (P1) — 完了 (2026-01-19)
- ブランチ名: fix/ui-map/feature-list-column-toggle
- 依存: なし
- 受け入れ基準: フィーチャー一覧の列表示/非表示トグルが保持される（チェックが即座に戻らない）／MapLibre の Unknown expression "feature-atoms" が発生しない／影響範囲とロールバック手順が明記される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/**`, `packages/components/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、列表示トグルと MapLibre 式を修正前に戻す
- チェックリスト:
  - フィーチャー一覧のカラム表示状態が即座に戻る原因を特定する
  - カラム表示の保存/復元を正しく動作させる
  - MapLibre の feature-atoms を含む式を特定し修正する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 02:10 JST フィーチャー一覧のカラム表示トグル不具合と MapLibre feature-atoms エラーの修正に着手。
  - done: 2026-01-19 02:18 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:32 JST フィーチャー一覧のローディング表示の高さ揺れ対策とスクロールの wheel 伝播抑止に着手。
  - done: 2026-01-19 02:33 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:40 JST フローティング一覧の TableContainer 高さ指定を見直し、スクロール可能な overflow 設定を調整。
  - done: 2026-01-19 02:41 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 02:50 JST フローティング一覧の余白解消と高さ一致のため、コンテナの高さ設定を再調整。
  - done: 2026-01-19 02:52 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:00 JST テーブルの wheel イベントを capture で抑止し、Map 側のズーム干渉を回避。
  - done: 2026-01-19 03:02 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-19 03:10 JST pnpm typecheck が exit 2（MapPreviewFloatingTable の未使用 maxHeight）で失敗。
  - done: 2026-01-19 03:12 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:25 JST フィーチャー一覧テーブルのスクロール不具合を再調査。
  - update: 2026-01-19 03:36 JST フローティング一覧のテーブル領域を高さ固定し、スクロール領域の高さを明示。
  - done: 2026-01-19 03:37 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 03:45 JST Transform で z0-z3 がゼロ化する原因の調査に着手。
  - update: 2026-01-19 03:57 JST pre-simplify の無効判定と oversized 処理を調整し、ゼロ化時のログを追加。
  - done: 2026-01-19 03:58 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:05 JST Step4 の VT キャッシュ削除ボタン件数/有効化の不一致を調査。
  - update: 2026-01-19 04:09 JST Step4 のカウント取得順を修正し VT 件数が正しく反映されるよう調整。
  - done: 2026-01-19 04:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:13 JST Transform の skipped メッセージに features/polygons の比率を含める修正に着手。
  - done: 2026-01-19 04:14 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:18 JST Step6 フィーチャーテーブルの状態ソート不具合と ADM0/ADM1 表示差分の由来を調査。
  - update: 2026-01-19 04:26 JST 状態カラムのソート用フィールドを追加し、ADM0/ADM1 の表示由来を整理。
  - done: 2026-01-19 04:27 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 04:40 JST Step6 フィーチャー一覧の Country/Admin/DataSource 正規化と FeatureID 一意化の対応に着手。
  - update: 2026-01-19 05:02 JST Step6 フィーチャー一覧の Country/Admin/DataSource 正規化と Transform エラー行の FeatureID 一意化を実装。
  - done: 2026-01-19 05:03 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 05:16 JST VT 並列度のデフォルトを 1 に統一し、テンプレートの vtConfig.maxConcurrent を更新。

2247) feat/shape/transform-preprocess-diagnostics (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/transform-preprocess-diagnostics
- 依存: なし
- ExecPlan: plans/shape-transform-preprocess-diagnostics-execplan.md
- 受け入れ基準: simplify 前処理のログが feature/polygon 単位で問題箇所と理由を示す／問題ジオメトリをプレビューで視覚確認できる／過剰な前処理で地物が欠落しないよう処理方針が見直される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/features/shape-store/src/**`, `packages/plugin-service-api/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`（調査後に確定）
- ロールバック手順: 追加した診断/プレビュー/前処理変更を revert し、transform のログ・前処理を修正前へ戻す
- チェックリスト:
  - simplify 前処理とログ出力の現状を整理する
  - 問題ジオメトリを feature/polygon 単位で記録する仕組みを追加する
  - Step6 のプレビューで問題ジオメトリを可視化する
  - 前処理の省略ロジックを見直し、必要な地物が欠落しないよう調整する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 00:30 JST simplify 前処理の診断ログ/可視化と前処理見直しの ExecPlan 作成に着手。
  - update: 2026-01-19 09:40 JST simplify 前処理で issueKind/issueStage を収集し、エラー記録とプレビュー用ライン生成へ反映する実装に着手。
  - update: 2026-01-19 10:05 JST Step6 プレビューで issueKind に応じてエラーラインの色分けを行う調整に着手。
  - blocked: 2026-01-19 10:14 JST pnpm typecheck が exit 2（vt-orchestrator build:types で ShapeTransformErrorRecord に issueStage が無い）で失敗。
  - update: 2026-01-19 10:15 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 10:16 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 11:40 JST 実装完了。手動での Japan ADM0/ADM1 確認は未実施。
  - update: 2026-01-19 10:20 JST ringFix/selfIntersection の invalid 発生箇所を特定するため、simplify の診断ログを拡充する対応に着手。
  - done: 2026-01-19 10:28 JST ringFix/selfIntersection の invalid 診断ログを詳細化。
  - done: 2026-01-19 10:29 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:35 JST simplify 診断ログにフィルタ用 prefix を付与。
  - update: 2026-01-19 10:41 JST simplify が空でも preprocessing issue 集計ログを出力するよう順序を調整。
  - done: 2026-01-19 10:42 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:48 JST ringFix/selfIntersection の invalid 時に詳細診断ログを出すよう追加。
  - done: 2026-01-19 10:49 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 10:56 JST ringFix invalid を即 drop せず selfIntersection まで通し、交差後に ringFix を再適用する修正を追加。
  - done: 2026-01-19 10:57 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:04 JST selfIntersection 後に unkink+ringFix で valid 回復を試みる経路を追加。
  - done: 2026-01-19 11:05 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:12 JST ringFix/selfIntersection の invalid を unkink 経由で回復し、成功時に採用する経路を拡張。
  - done: 2026-01-19 11:13 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - update: 2026-01-19 11:21 JST pipeline の各ステージ完了時にタスク件数を出す診断ログを追加。
  - done: 2026-01-19 11:22 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2246) fix/shape/step6-preview-feature-atoms-expression (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step6-preview-feature-atoms-expression
- 依存: なし
- 受け入れ基準: Step6 プレビューで MapLibre の Unknown expression "feature-atoms" が発生しない／fill-outline-color の式が MapLibre 仕様に沿って評価される／影響範囲とロールバック手順が明記される／pnpm typecheck が exit 0 で完走する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step6 プレビューのレイヤ設定を修正前へ戻す
- チェックリスト:
  - feature-atoms を使っている式の定義箇所を特定する
  - MapLibre の式仕様に合わせて修正する
  - Step6 プレビューでレイヤ追加が失敗しないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:50 JST Step6 プレビューで Unknown expression "feature-atoms" が発生する問題の調査に着手。
  - update: 2026-01-17 23:55 JST Step6 の MapLibre 式を feature-state へ置換し、MapLibre の式仕様に合わせて修正。
  - done: 2026-01-17 23:58 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:05 JST setFeatureState で sourceLayer が必須になるエラーの調査に着手。
  - update: 2026-01-18 00:15 JST highlight 用の feature entry に sourceLayer を追加し、set/removeFeatureState へ渡すよう修正。
  - done: 2026-01-18 00:18 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2247) refactor/shape/strict-task-stage-type (P1) — 完了 (2026-01-17)
- ブランチ名: refactor/shape/strict-task-stage-type
- 依存: なし
- 受け入れ基準: shape ビルドのタスク stage が TaskStage（'fetch'|'transform'|'vt'）として型制約される／フォールバックなしで stage が決定され、無効な値は明示的にエラーになる／UI のタスク表示と進捗が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`（必要に応じて関連ファイルを追記）
- 要点: stage の型を TaskStage に統一し、不正値はエラーとして扱うように変更。
- ロールバック手順: 該当差分を revert し、stage を string 扱いに戻す
- チェックリスト:
  - shape ビルドのタスク型に TaskStage を適用する
  - stage が不正な場合はエラー扱いにし、暗黙フォールバックを排除する
  - 進捗/ログ表示の回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:50 JST shape ビルドのタスク stage 型を TaskStage に厳格化する対応に着手。
  - update: 2026-01-17 23:56 JST @hierarchidb/ui-batch-progress の型変更に合わせて build を実行（tsdown define 警告あり、exit 0）。
  - done: 2026-01-17 23:57 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-17 23:58 JST shape ビルドの task stage を TaskStage に厳格化し、フォールバックを排除。

2246) fix/shape/skipped-task-stage-label (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/skipped-task-stage-label
- 依存: なし
- 受け入れ基準: skipped: simplify のタスクが stage=transform でログ出力される／警告ログのステージ表示が実際のタスク種別と一致する／既存のタスク表示や進捗に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`（必要に応じて関連ファイルを追記）
- 要点: ステージ不明時の fetch/download フォールバックを撤廃し、unknown で明示化。
- ロールバック手順: 該当差分を revert し、従来のステージ表示に戻す
- チェックリスト:
  - skipped 判定時のログ出力が task.type に基づくことを確認する
  - 表示・進捗に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 23:22 JST skipped: simplify の stage 表示が fetch になる問題の修正に着手。
  - done: 2026-01-17 23:25 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - done: 2026-01-17 23:26 JST skipped タスクのログ出力を task.type ベースに修正。
  - update: 2026-01-17 23:33 JST normalizeStageKey の fetch フォールバックを撤廃し unknown に変更。
  - done: 2026-01-17 23:34 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-17 23:41 JST useBuildTaskProgress の download フォールバックを unknown に変更し、ステージ誤分類を排除。
  - done: 2026-01-17 23:42 JST pnpm --filter @hierarchidb/ui-batch-progress typecheck を実行（exit 0）。

2245) feat/ui-auth/unauthenticated-avatar-menu (P1) — 完了 (2026-01-17)
- ブランチ名: feat/ui-auth/unauthenticated-avatar-menu
- 依存: なし
- 受け入れ基準: 未ログイン時でも UserAvatarMenu が表示される／未ログイン時はユーザ名・メール表示の代わりに Login ボタンが表示され認証フローが開始できる／テーマ・言語・全データ削除は未ログインでも実行可能／Logout は未ログイン時 disabled 表示／TASKS.md に運用ログを記載する
- 要点: 未ログイン時もメニューを表示し、Login 導線と Logout disabled を追加。
- 影響範囲: `packages/ui/auth/src/components/UserAvatarMenu.tsx`（必要に応じて関連ファイルを追記）
- ロールバック手順: 該当差分を revert し、未ログイン時は認証フロー開始ダイアログのみを表示する挙動に戻す
- チェックリスト:
  - 未ログイン時に UserAvatarMenu を表示する条件分岐を整理する
  - Login ボタンの表示と認証フロー開始の導線を実装する
  - 未ログイン時の Logout を disabled 表示にする
  - テーマ・言語・全データ削除が未ログイン時も利用可能であることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 22:40 JST 未ログイン時に UserAvatarMenu を表示し Login ボタンを追加する対応に着手。
  - done: 2026-01-17 22:43 JST pnpm --filter @hierarchidb/ui-auth typecheck を実行（exit 0）。
  - update: 2026-01-17 22:44 JST 未ログイン時も UserAvatarMenu を表示し Login/Logout 表示を更新。
  - update: 2026-01-17 22:48 JST 右上ログインボタンでメニューが表示されない報告を受け、UserLoginButton 側の挙動を調整する。
  - done: 2026-01-17 22:58 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。
  - done: 2026-01-17 22:59 JST 未ログイン時もユーザーメニューを表示し Login ボタン/Logout disabled を反映。
  - done: 2026-01-17 23:06 JST Login ボタンを large にし、メニュー閉じる前にフォーカスを外すよう調整。
  - done: 2026-01-17 23:07 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。
  - update: 2026-01-17 23:15 JST Login 押下時の aria-hidden 警告が残るため、メニュー終了後に認証ダイアログを開くよう変更。
  - done: 2026-01-17 23:16 JST pnpm --filter @hierarchidb/ui-usermenu typecheck を実行（exit 0）。

2244) fix/ui-auth/clear-all-data-indexeddb (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-auth/clear-all-data-indexeddb
- 依存: なし
- 受け入れ基準: UserAvatarMenu の "clear all data" 実行後に IndexedDB の関連 DB が削除される／削除対象の一覧と理由が説明できる／削除できない DB がある場合は理由と回避策が明記される／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/components/UserAvatarMenu.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、clear all data の削除挙動を修正前に戻す
- チェックリスト:
  - clear all data の実装箇所と削除対象の DB を洗い出す
  - IndexedDB の削除が残る原因を特定する
  - 必要な修正を実装する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 18:17 JST UserAvatarMenu の clear all data 実行後に IndexedDB が残る問題の調査に着手。
  - update: 2026-01-17 18:20 JST IndexedDB 削除の onblocked/onerror を検知し、失敗時は警告表示するように修正。
  - update: 2026-01-17 18:21 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2243) fix/shape/step3-virtualized-checkbox-scroll (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step3-virtualized-checkbox-scroll
- 依存: なし
- 受け入れ基準: Step3 の仮想化リストで途中スクロール位置のチェックボックスをクリックしてもスクロール位置が先頭に戻らない／チェック状態の更新で全体再レンダリングが発生しない（またはスクロール位置への影響がない）／ステップ遷移と Save/Save as Draft の挙動が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step3 のチェックボックス操作とスクロール挙動を修正前へ戻す
- チェックリスト:
  - Step3 仮想化リストの再レンダリング原因を特定する
  - チェック状態の保存タイミングを見直し、スクロール位置が維持されることを確認する
  - ステップ遷移と Save/Save as Draft の挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 16:51 JST Step3 仮想化リストのチェック操作でスクロール位置が戻る問題の修正に着手。
  - update: 2026-01-17 16:55 JST CountryMatrixSelector の行配列が選択変更で再生成されないように依存関係を調整。
  - done: 2026-01-17 16:55 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。
  - update: 2026-01-17 17:14 JST Step3 の countries 配列参照をメモ化し、選択変更時の仮想化データ再生成を抑制。
  - done: 2026-01-17 17:14 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-17 17:18 JST SelectionMatrix へ渡す rows 配列をメモ化し、選択変更時のデータ参照揺れを抑制。
  - done: 2026-01-17 17:18 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。
  - update: 2026-01-17 17:23 JST SelectionMatrix の Virtuoso components/スタイルをメモ化し、レンダリング時のスクロールリセットを抑制。
  - done: 2026-01-17 17:23 JST pnpm --filter @hierarchidb/components typecheck を実行（exit 0）。
  - update: 2026-01-17 17:40 JST CountryMatrixSelector の Virtuoso ハンドル型を整理し、null許容のref型に修正。
  - done: 2026-01-17 17:40 JST pnpm --filter @hierarchidb/ui-country-select typecheck を実行（exit 0）。

2241) refactor/shape/remove-transform-by-zoom (P2) — 完了 (2026-01-17)
- ブランチ名: refactor/shape/remove-transform-by-zoom
- 依存: なし
- ExecPlan: `plans/remove-transform-by-zoom-execplan.md`
- 受け入れ基準: transform-by-zoom が型定義/実装/表示経路から除去され transform に一本化される／Step4 の Transform キャッシュ削除が transform 関連のタスク・キャッシュを漏れなく削除する／processingStatus と tileSummary が transform タスク実行抑止の判断材料として使われない／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 要点: transform-by-zoom を廃止し、Transform キャッシュ削除時のタスク整理と runtime 状態優先の再開判定を反映。
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/features/shape-store/src/**`, `packages/features/gis-sdk/src/**`, `packages/plugin-service-api/src/**`, `packages/common/types/src/**`, `packages/runtime-worker/src/**`, `packages/vt-orchestrator/src/**`
- ロールバック手順: 該当差分を revert し、transform-by-zoom を含む従来のタスク/型経路に戻す
- チェックリスト:
  - transform-by-zoom の型定義を削除し、transform に一本化する
  - 参照箇所（worker/api, task queue, session mappers, EphemeralDB など）を更新する
  - Step4 の Transform キャッシュ削除でタスク/エラー/関連キャッシュを漏れなく削除する
  - processingStatus/tileSummary が transform タスク実行抑止条件になっていないことを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 19:20 JST transform-by-zoom 廃止と transform 一本化の調査・実装に着手。
  - blocked: 2026-01-17 19:35 JST pnpm typecheck が exit 2（ShapeBuildStage と BuildTaskType の不一致）で失敗。
  - update: 2026-01-17 19:38 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 19:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2242) feat/shape/build-continuation-policy (P2) — 完了 (2026-01-17)
- ブランチ名: feat/shape/build-continuation-policy
- 依存: なし
- ExecPlan: `plans/build-continuation-policy-execplan.md`
- 受け入れ基準: TreeConsole の buildContinuationPolicy が Shape ビルド実行に渡される／finish_all_stages でエラー後も次ステージへ進む／finish_stage_then_stop でそのステージは完走するが次ステージへ進まない／stop_on_first_error でステージ内の最初の失敗で停止する／pnpm typecheck が exit 0 で通る／TASKS.md に運用ログを記載する
- 要点: TreeConsole の buildContinuationPolicy を Shape ビルド実行に反映し、ステージ継続/停止ポリシーを実装。
- 影響範囲: `app/src/worker-runtime/worker.ts`, `packages/common/api/src/WorkerAPI.ts`, `packages/ui/worker-client/src/workerBridge.ts`, `plugins/shape-plugin/src/ui/components/step5/**`, `plugins/shape-plugin/src/services/vt/**`, `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 該当差分を revert し、buildContinuationPolicy を UI 設定のみの状態へ戻す
- チェックリスト:
  - buildContinuationPolicy を start/resume 経路で Worker API に渡す
  - Shape ビルドパイプラインで failureHandling とステージ継続条件を適用する
  - finish_all_stages / finish_stage_then_stop / stop_on_first_error の挙動を反映する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 20:00 JST buildContinuationPolicy の実行反映に着手。
  - blocked: 2026-01-17 20:25 JST pnpm typecheck が exit 2（shape-plugin/app の startBatchSession 引数数不一致）で失敗。
  - update: 2026-01-17 20:28 JST pnpm --filter @hierarchidb/common-api build / pnpm --filter @hierarchidb/ui-worker-client build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 20:31 JST app の ShapeBatchAPI 型を buildContinuationPolicy 対応に更新。
  - done: 2026-01-17 20:33 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2240) chore/analysis/list-large-react-components (P3) — 完了 (2026-01-17)
- ブランチ名: chore/analysis/list-large-react-components
- 依存: なし
- ExecPlan: `plans/react-components-hook-extraction-execplan.md`
- 受け入れ基準: packages/app/plugins 配下の *.tsx から 200行以上の React コンポーネントを抽出し列挙する／各コンポーネントについて「カスタムフックへのロジック切り出しが無い」ことを判断できる根拠を簡潔に示す／要確認は明記する／列挙対象のコンポーネントでロジックをカスタムフックとして外部ファイルへ抽出する／挙動が維持される／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/**`, `plugins/*-plugin/src/ui/**`
- チェックリスト:
  - packages/**/src 配下の .tsx を対象に行数を集計する
  - 200行以上の React コンポーネントを抽出して列挙する
  - カスタムフック切り出しの有無を簡潔にメモする
  - app/src と plugins/*/src も同条件で抽出する
  - 対象コンポーネントでロジックをカスタムフックへ外部化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 17:05 JST 200行以上の React コンポーネントとカスタムフック未抽出の一覧化に着手。
  - done: 2026-01-17 17:12 JST packages/**/src の .tsx を行数集計し、200行以上のコンポーネントからローカルカスタムフック未抽出の一覧を作成。
  - done: 2026-01-17 17:16 JST app/src と plugins/*/src も同条件で抽出し、200行以上かつローカルフック未抽出の一覧を追記。
  - blocked: 2026-01-17 18:20 JST pnpm typecheck が exit 1（未使用 import/型、正規表現エスケープ、戻り値の不整合）で失敗。
  - update: 2026-01-17 18:35 JST 未使用 import/型の削除、正規表現のエスケープ修正、戻り値の補正を反映。
  - done: 2026-01-17 18:45 JST pnpm typecheck を再実行（exit 0）し、app/src/router/** と plugins/*-plugin/src/ui/** の対象コンポーネントをカスタムフック外部化。
  - update: 2026-01-17 19:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2239) feat/shape/step4-area-filter-coefficient (P1) — 完了 (2026-01-17)
- ブランチ名: feat/shape/step4-area-filter-coefficient
- 依存: なし
- 受け入れ基準: Step4 Transform の「面積フィルター」カードが撤去される／除外ポリゴン面積係数の UI が Step4 Transform に追加される／設定値がビルド設定に保存・再読込される／既存の Step4 UI に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、面積フィルター UI と係数 UI を修正前へ戻す
- チェックリスト:
  - Step4 Transform の面積フィルター UI を撤去する
  - 除外ポリゴン面積係数のフォームを追加する
  - 設定の保存・再読込が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 16:40 JST Step4 Transform の面積フィルター撤去と係数 UI 追加に着手。
  - update: 2026-01-17 16:45 JST 面積フィルター UI を削除し、Transform のヘルプ文言と係数 UI を整理。
  - update: 2026-01-17 17:10 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 17:10 JST 面積フィルター撤去と除外ポリゴン面積係数 UI を反映。

2240) fix/shape/vt-stage-not-starting (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/vt-stage-not-starting
- 依存: なし
- 受け入れ基準: VT 生成ステージが transform 完了後に開始される／原因がログで説明できる／必要に応じて失敗理由がUI/ログに残る／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/services/vt/**`, `packages/vt-orchestrator/src/**`, `plugins/shape-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、VT 開始条件の挙動を修正前に戻す
- チェックリスト:
  - VT ステージが開始されない原因を特定する
  - 必要な修正を反映し VT ステージ開始を復旧する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 17:20 JST VT 生成ステージが開始しない事象の調査に着手。
  - update: 2026-01-17 17:25 JST shapePipeline の backfill で transformCache の decode 失敗時に vt タスクが生成されずスキップされる経路を確認。
  - update: 2026-01-17 21:15 JST ユーザー報告: vt ステージで transform cache decode failed が発生し、buildStatus が failed になるが error/message が null。原因調査を開始。
  - update: 2026-01-17 21:42 JST transformCache の timestamp=0 を「書き込み未完了」として扱い、読取側で除外する対応を実装。
  - done: 2026-01-17 21:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-17 22:05 JST 新規報告: vt タスクで "start offset of Float64Array should be a multiple of 8" が発生。FlatGeobuf decode 失敗の追加原因を調査。
  - update: 2026-01-17 22:20 JST decode 失敗時に bufferId/length/先頭バイト/JSON判定をログ出力する診断を追加。
  - update: 2026-01-17 22:40 JST transformCache の書き込みがトランザクションかどうかを確認する調査に着手。
  - update: 2026-01-17 23:15 JST transformCache の読み書きを全経路で Dexie transaction に統一（put/bulkPut と timestamp 更新を同一トランザクション化）。
  - done: 2026-01-17 23:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:30 JST transformCache の空バッファ検出で例外を投げる対応に着手。
  - done: 2026-01-17 23:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 22:22 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck が TS2322 で失敗（decode 診断の型）。
  - done: 2026-01-17 22:23 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を再実行（exit 0）。
  - update: 2026-01-17 23:55 JST simplify 前処理の実装順と不正ジオメトリ対策の現状を整理し、改善案を検討。
  - update: 2026-01-18 00:10 JST simplify 後に再検証を追加し、不正ジオメトリで transform を失敗させる（A）と lat clamp（B）を実装。
  - done: 2026-01-18 00:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:30 JST simplify 前処理で非有限座標を除去し、encode後のFlatGeobuf自己検証で不正バッファを検出して停止する対応を追加。
  - done: 2026-01-18 00:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:55 JST simplify 前処理で非有限/不正/空ジオメトリを feature から除外するように調整。
  - done: 2026-01-18 01:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 19:45 JST transform ハング調査のため簡易化進捗ログと停止条件の追加に着手。
  - blocked: 2026-01-17 19:45 JST pnpm typecheck が exit 2（vt-orchestrator build:types で PreSimplifyFilterConfig の型更新が未反映）で失敗。
  - update: 2026-01-17 19:50 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 19:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 19:52 JST simplify 空出力時に encode をスキップして失敗させるチェックを追加。
  - done: 2026-01-17 19:52 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 20:05 JST simplify/出力が空の場合は transform を skipped 扱いで完了させるよう修正。
  - done: 2026-01-17 20:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:20 JST Step4 の VT メタデータ件数/削除ボタンが 0 件のままになるため、vt-store 側の vtTiles を参照するよう取得/削除経路を更新。
  - done: 2026-01-18 02:21 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:40 JST Step5 の transform skipped 表示と VT タスク進捗（総タイル数ベース）の表示差分を修正する対応に着手。
  - done: 2026-01-18 02:55 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 03:15 JST Step4 の VT 件数をタスク件数へ統一し、VT タスクタイトルを band/zoom/featureCount 形式に変更。
  - done: 2026-01-18 03:16 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 01:40 JST simplify 空結果時のエラー項目生成と transform 後の feature metadata 生成の追加に着手。
  - done: 2026-01-19 01:46 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 11:45 JST 実装完了。VT ステージ開始の手動確認は未実施。

2239) fix/plugin-dialog/fullscreen-header-footer-auto-hide (P1) — 完了 (2026-01-17)
- ブランチ名: fix/plugin-dialog/fullscreen-header-footer-auto-hide
- 依存: なし
- 受け入れ基準: 全画面化中のみヘッダが上端16pxセンサー領域への侵入で表示され、ヘッダ領域からマウスが出たら非表示になる／フッタも下端16pxセンサー領域で同様に表示/非表示となる／非全画面時のヘッダ/フッタ表示に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`, `packages/plugin-ui-host/src/headless/components/PluginDialogFooter.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、全画面時のヘッダ/フッタ自動表示を修正前へ戻す
- チェックリスト:
  - 全画面時のヘッダ/フッタ表示制御の実装箇所を特定する
  - 上端/下端16pxのセンサー領域で表示し、ヘッダ/フッタから出たら非表示にする
  - 非全画面時の表示に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:35 JST 全画面プラグインダイアログのヘッダ/フッタ自動表示対応に着手。
  - update: 2026-01-17 15:38 JST PluginDialogHeader/Footer に全画面センサー領域と表示/非表示の制御を追加。
  - update: 2026-01-17 15:39 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:39 JST 全画面プラグインダイアログのヘッダ/フッタ自動表示を反映。
  - done: 2026-01-19 13:05 JST 実装済みのため完了へ変更（再検証は未実施）。

2238) fix/ui-floating-window/resize-start-jump (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-floating-window/resize-start-jump
- 依存: なし
- 受け入れ基準: リサイズ開始時にウィンドウ位置がジャンプしない／全方向のリサイズ開始が安定する／既存のドラッグ移動・クランプ・最小化/最大化に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、リサイズ開始時の挙動を修正前へ戻す
- チェックリスト:
  - リサイズ開始時に旧位置が参照される箇所を特定する
  - 位置が最新状態で開始されるよう修正する
  - 既存のドラッグ移動/リサイズ動作の回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:20 JST リサイズ開始時の位置ジャンプ問題の修正に着手。
  - update: 2026-01-17 15:22 JST リサイズ開始ハンドラに最新位置を反映するよう依存配列を修正。
  - update: 2026-01-17 15:23 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:23 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:23 JST リサイズ開始時の位置ジャンプを解消。

2237) fix/ui-floating-window/resize-left-top (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/ui-floating-window/resize-left-top
- 依存: なし
- 受け入れ基準: フローティングウィンドウの上端・左端リサイズドラッグでドラッグ量とサイズ/位置変化が一致する／右端・下端の既存挙動に回帰がない／最小サイズやクランプの挙動が不整合を起こさない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、上端・左端リサイズ挙動を修正前へ戻す
- チェックリスト:
  - 上端・左端リサイズの計算ロジックを特定する
  - ドラッグ量と一致する位置/サイズ更新に修正する
  - 右端・下端のリサイズとドラッグ移動に回帰がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 15:10 JST 上端・左端リサイズドラッグの挙動不整合の修正に着手。
  - update: 2026-01-17 15:12 JST 左端/上端リサイズ時に開始位置を基準にサイズと位置を再計算するよう修正。
  - update: 2026-01-17 15:13 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:13 JST pnpm typecheck を実行（exit 0）。
  - done: 2026-01-17 15:13 JST 上端・左端リサイズドラッグの挙動を修正。

2236) fix/shape/step6-floating-window-icons-columns (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/step6-floating-window-icons-columns
- 依存: なし
- 受け入れ基準: Step6 フローティングウィンドウのタイトルバー左端アイコンがHexagonになる／再表示ボタンのアイコンもHexagonになる／カラム表示設定の初期値はlocalStorageまたは全表示デフォルトから取得される／変更時にlocalStorageへ永続化される／既存のStep6表示/操作に副作用がない／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/map/src/preview/ShapePreviewList.tsx`, `packages/ui/map/src/preview/MapPreviewFloatingTable.tsx`, `packages/ui/floating-window/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、アイコン/カラム永続化を修正前へ戻す
- チェックリスト:
  - Hexagon アイコンの適用箇所を特定し置換する
  - カラム表示の初期化/永続化を追加する
  - localStorage が無い環境でも安全に動作することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:47 JST Step6 フローティングウィンドウのHexagon化とカラム永続化に着手。

2235) fix/shape/step6-floating-window-reopen (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step6-floating-window-reopen
- 依存: なし
- 受け入れ基準: shape Step6 のフローティングウィンドウを閉じた後に再表示用のアイコンボタン（color="primary" size="large" variant="contained"）が地図左上に表示される／ボタン押下でフローティングウィンドウが再表示される／darkモードでもFitボタン内アイコンが表示され空白にならない／既存のStep6の表示/操作に副作用がない／TASKS.mdに運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/map/src/components/ResourceLayerMap.tsx`, `packages/ui/map/src/preview/ShapePreviewList.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、フローティングウィンドウの再表示ボタンとFitアイコン表示を修正前へ戻す
- チェックリスト:
  - Step6のフローティングウィンドウ閉じ/再表示の状態管理を追加する
  - 地図左上に再表示ボタンを配置する
  - darkモードのFitボタン内アイコンの表示を修正する
  - 既存のStep6表示/操作が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:42 JST Step6のフローティングウィンドウ再表示ボタン追加とFitアイコンのdark表示修正に着手。
  - update: 2026-01-17 13:44 JST ShapePreviewStep に再表示ボタンを追加し、ShapePreviewList の onClose で閉じ状態を管理。
  - update: 2026-01-17 13:44 JST Fitボタンのアイコン色とdisabled色をdarkモード向けに補正。
  - blocked: 2026-01-17 13:45 JST pnpm typecheck が ui-map の dist 型未更新で ShapePreviewList onClose 追加に失敗。
  - update: 2026-01-17 13:45 JST pnpm --filter @hierarchidb/ui-map build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:45 JST Step6 の再表示ボタン追加とFitアイコンのdark表示補正を完了。

2234) fix/ui-map/fit-button-icon-dark-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-map/fit-button-icon-dark-grey
- 依存: なし
- 受け入れ基準: Fitボタン内アイコンがdarkモード時にgrey表示になる／lightモードの色は維持される／既存のdisabled/hover/クリック挙動に影響がない／TASKS.mdに運用ログを記載する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Fitボタンのアイコン色を修正前へ戻す
- チェックリスト:
  - Fitボタンのアイコン色制御箇所を特定する
  - darkモード時にgreyになるようスタイルを調整する
  - lightモードでの表示と動作を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:38 JST Fitボタン内アイコンのdarkモード色をgrey化する対応に着手。
  - update: 2026-01-17 13:39 JST FitボタンのIconButton colorをdarkモード時のみgreyに切替。
  - update: 2026-01-17 13:39 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:39 JST Fitボタン内アイコンのdarkモード色をgrey化。

2233) fix/ui-floating-window/drag-clamp (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-floating-window/drag-clamp
- 依存: なし
- 受け入れ基準: フローティングウィンドウの移動クランプが「全体が画面内」から「左端64px・上端24pxが画面内」に変わる／既存のドラッグ・リサイズ・最小化・最大化の挙動に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/floating-window/src/components/FloatingWindow.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、クランプ範囲を修正前の全画面内制約へ戻す
- チェックリスト:
  - 既存のクランプ処理箇所を特定する
  - 左端64px・上端24pxが画面内になるようクランプ条件を変更する
  - 既存のドラッグ/リサイズ動作が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 13:36 JST フローティングウィンドウのドラッグクランプを左端64px・上端24px保持に変更する対応に着手。
  - update: 2026-01-17 13:37 JST FloatingWindow のクランプ範囲を左端64px・上端24pxの可視条件に変更。
  - update: 2026-01-17 13:37 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 13:37 JST フローティングウィンドウのクランプ条件を指定の可視範囲に更新。

2232) fix/shape/step5-6-direct-url (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-6-direct-url
- 依存: なし
- 受け入れ基準: shape の step5/step6 を直URL指定した場合に step4 へ戻されず指定ステップが表示される／Stepper の valid 表示と表示中ステップが一致する／step4 経由の遷移挙動は維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/plugin-ui-host/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、直URLアクセス時のステップ遷移挙動を修正前に戻す
- チェックリスト:
  - 直URLアクセス時に step4 へ戻される経路を特定する
  - step5/step6 を指定した場合に該当ステップを表示するよう修正する
  - Stepper の valid 表示と表示ステップの整合性を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 12:25 JST shape の step5/6 直URLアクセス時に step4 へ戻される問題の修正に着手。
  - update: 2026-01-17 12:31 JST PluginDialogRoute で params.step が無い場合もURLから step を解釈して初期ステップを維持するよう対応。
  - blocked: 2026-01-17 12:33 JST pnpm typecheck が PluginDialogRoute の pathOnly/normalizedPath nullability で失敗。
  - update: 2026-01-17 12:33 JST pathOnly/normalizedPath の default を補正し、pnpm typecheck を再実行（exit 0）。
  - done: 2026-01-19 11:50 JST 実装完了。直URLアクセスの手動確認は未実施。

2232) feat/build/continuation-policy (P1) — 進行中 (2026-01-17)
- ブランチ名: feat/build/continuation-policy
- 依存: なし
- ExecPlan: `plans/build-continuation-policy-execplan.md`
- 受け入れ基準: TreeConsole のツールバーメニューにビルド継続ポリシー（3択）が追加される／shape/location/route のビルド設定に保存・再読込される／ビルド処理がポリシーに従って継続/停止する／文言が i18n 化される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `app/src/**`, `packages/ui/**`, `plugins/shape-plugin/src/**`, `plugins/location-plugin/src/**`, `plugins/route-plugin/src/**`, `packages/vt-orchestrator/src/**`, `packages/features/gis-sdk/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ビルド継続ポリシー UI と停止条件を修正前に戻す
- チェックリスト:
  - ビルド継続ポリシーの型/保存スキーマを追加する
  - TreeConsole ツールバーのメニュー UI を追加する
  - shape/location/route のビルド実行でポリシーを反映する
  - i18n を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 14:00 JST build 継続ポリシーの UI と処理反映に着手。
  - update: 2026-01-17 16:47 JST treeConsoleSettings の null 判定を整理して typecheck エラーを解消。
  - update: 2026-01-17 16:49 JST util の tsconfig paths を整理し common-types の解決を復旧。
  - update: 2026-01-17 16:52 JST treeconsole-toolbar の tsconfig paths を整理し common-types の解決を復旧。
  - update: 2026-01-17 17:10 JST pnpm typecheck を実行（exit 0）。

2231) feat/shape/step4-vt-config-refine (P1) — 完了 (2026-01-17)
- ブランチ名: feat/shape/step4-vt-config-refine
- 依存: なし
- 受け入れ基準: Step4 の「ビルド終了時の中間生成物の保持」に VT キャッシュ保持スイッチが追加され、CleanupConfig に設定が保存/再読込される／VT キャッシュの自動削除条件が新規フラグで制御される／VT 生成アコーディオンの項目が整理され、詳細設定セクションが適用される／VT 設定のヘルプテキストが充実し i18n 化される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/ui/locales/*`, `plugins/shape-plugin/src/services/batch/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step4 の VT 設定 UI と CleanupConfig を修正前へ戻す
- チェックリスト:
  - CleanupConfig に VT キャッシュ保持用フラグを追加する
  - Step4 の「中間生成物の保持」に VT キャッシュ保持スイッチを追加する
  - VT 生成アコーディオンの項目を整理し詳細設定セクションへ分離する
  - VT 設定のヘルプテキストを拡充し i18n へ移行する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 11:16 JST Step4 VT 設定の保持スイッチ追加とアコーディオン整理に着手。
  - blocked: 2026-01-17 11:20 JST pnpm typecheck が CleanupConfig の deleteVTCache 未反映で失敗。
  - update: 2026-01-17 11:22 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:23 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 11:23 JST VT キャッシュ保持スイッチ追加、VT 設定アコーディオン整理とヘルプ/i18n を反映。

2232) fix/shape/step6-fit-button-align (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/step6-fit-button-align
- 依存: なし
- 受け入れ基準: Step6 プレビューでFitボタンがズームコントロール直下に揃う／Fitボタン背景色がズームコントロールと一致する／既存のクリック挙動・disabled 条件・表示モードに影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`
- ロールバック手順: 該当差分を revert し、Fitボタンの配置/スタイルを修正前へ戻す
- チェックリスト:
  - Fitボタンの配置・サイズをズームコントロールと揃える
  - Fitボタン背景色をズームコントロールと一致させる
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 04:10 JST Step6 プレビューのFitボタン位置/背景色調整に着手。
  - update: 2026-01-19 04:20 JST FitボタンをMapLibreのコントロールグループに合わせ、サイズと背景色を調整。
  - blocked: 2026-01-19 04:25 JST pnpm typecheck が app の PluginDialogRoute の未定義パス判定で失敗。
  - update: 2026-01-19 04:30 JST PluginDialogRoute のステップ抽出で空パスを早期returnするよう修正。
  - update: 2026-01-19 04:35 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 04:35 JST Fitボタンの整列と背景色調整を完了。

2231) fix/shape/step6-preview-control-order (P1) — 完了 (2026-01-19)
- ブランチ名: fix/shape/step6-preview-control-order
- 依存: なし
- 受け入れ基準: Step6 プレビューでズームコントロールが上、Fit ボタンが下に配置される／クリック挙動・disabled 条件・表示モードに影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/components/ResourceLayerMap.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Fit ボタン配置を修正前へ戻す
- チェックリスト:
  - Fit ボタンの配置順がズームコントロールの下になるよう調整する
  - 既存の挙動を維持する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 03:25 JST Step6 プレビューのズーム/フィット配置順調整に着手。
  - update: 2026-01-19 03:35 JST Fit ボタン用のコントロールコンテナを追加し、ズームコントロールの直下へ配置する処理を実装。
  - blocked: 2026-01-19 03:40 JST pnpm typecheck が ui-map の fitSelectionEnabled 参照順と MapPreviewFloatingTable の showSearch 型で失敗。
  - update: 2026-01-19 03:45 JST effect 順序を調整し showSearch を削除。
  - update: 2026-01-19 03:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 03:55 JST Step6 プレビューのズーム上/フィット下の配置順を反映。

2230) feat/shape/transform-pre-simplify-filters (P1) — 完了 (2026-01-19)
- ブランチ名: feat/shape/transform-pre-simplify-filters
- 依存: なし
- 受け入れ基準: TransformConfig 型に簡易化/事前フィルタ用の階層プロパティが追加される／テンプレートの buildConfig に新プロパティとデフォルトが反映される／Shape Step4 の Transform アコーディオンに新カードが追加され値が保存・再読込される／Transform ステージで新プロパティを参照して事前フィルタ/簡易化が動作する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/worker/**`, `packages/features/gis-sdk/src/types/**`, `app/public/templates/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Transform 設定/テンプレート/事前フィルタ処理を修正前に戻す
- チェックリスト:
  - TransformConfig 型へ簡易化/事前フィルタ用の階層プロパティを追加する
  - テンプレートの buildConfig に新プロパティとデフォルトを反映する
  - Step4 Transform の新カードを追加し、保存/再読込を配線する
  - Transform ステージで新プロパティを使った事前フィルタ/簡易化処理を適用する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 02:05 JST Transform 事前フィルタ/簡易化設定の型・テンプレート・UI・配線対応に着手。
  - update: 2026-01-19 02:45 JST TransformConfig の preSimplifyFilterConfig 追加、Step4 UI カードとテンプレート更新、事前フィルタ/簡易化処理を反映。
  - blocked: 2026-01-19 02:55 JST pnpm typecheck が vt-orchestrator の PreSimplifyFilterConfig 型未反映と ui-map/route-plugin の型エラーで失敗。
  - update: 2026-01-19 03:05 JST pnpm --filter @hierarchidb/gis-sdk build と pnpm --filter @hierarchidb/ui-map build を実行し、route-plugin の型注釈を修正。
  - update: 2026-01-19 03:15 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-19 03:15 JST 事前フィルタ/簡易化の設定追加と配線、UI/テンプレート反映を完了。

2224) fix/shape/step5-stage-progress-inactive-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-stage-progress-inactive-grey
- 依存: なし
- 受け入れ基準: Shape Step5 のステージ稼働状況が「稼働なし」の場合に CircularProgress が grey 表示になる／稼働中の表示ロジックは既存挙動を維持する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ステージ稼働状況の表示色を修正前に戻す
- チェックリスト:
  - Step5 のステージ稼働状況に「稼働なし」の色分け条件を追加する
  - 稼働中の表示ロジックが維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 08:56 JST Shape Step5 のステージ稼働なし時に grey 表示へ切り替える対応に着手。
  - update: 2026-01-17 09:03 JST BuildStepStagePanel の稼働なし時 CircularProgress を grey 表示に調整。
  - update: 2026-01-17 09:05 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 09:05 JST Step5 の稼働なし時に grey 表示となるよう反映。

2225) fix/shape/step5-progressbar-hover-title (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-progressbar-hover-title
- 依存: なし
- 受け入れ基準: Step5 のタスク進捗SVGでホバー時の表示が固定文言ではなく該当タスクのタイトルになる／既存の進捗表示・クリック/スクロール挙動に影響がない／タイトル不明時のフォールバックが明確である／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ホバー時表示を固定文言へ戻す
- チェックリスト:
  - TaskProgressBar のホバー時表示をタスクタイトルへ置換する
  - タイトル不明時のフォールバック表示を整理する
  - 既存の進捗/クリック/スクロール挙動が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 08:58 JST Step5 タスク進捗バーのホバー表示をタスクタイトルに変更する対応に着手。
  - update: 2026-01-17 09:00 JST TaskProgressBar のSVGホバー表示をタスクタイトルへ変更。
  - update: 2026-01-17 09:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-17 09:00 JST Step5 進捗バーのホバー表示をタスクタイトルへ切り替え完了。

2226) fix/ui-map/fitscreen-button-spacing (P1) — 完了 (2026-01-17)
- ブランチ名: fix/ui-map/fitscreen-button-spacing
- 依存: なし
- 受け入れ基準: FitScreen ボタンに paddingRight: 4px が適用される／variant が "compound" になる／height が 48px になる／既存の位置・disabled 条件・クリック挙動に影響がない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、FitScreen ボタンの表示設定を修正前に戻す
- チェックリスト:
  - FitScreen ボタンに paddingRight: 4px を設定する
  - FitScreen ボタンの variant を "compound" に設定する
  - FitScreen ボタンの高さを 48px に設定する
  - 既存挙動が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 09:09 JST FitScreen ボタンの paddingRight/variant/height 調整に着手。
  - update: 2026-01-19 12:20 JST FitScreen ボタンの表示コンテナ（ResourceLayerMap）を調査し、適用箇所の特定に着手。
  - update: 2026-01-19 12:35 JST FitScreen ボタンに paddingRight/height を追加し、variant=compound の識別属性を付与。
  - done: 2026-01-19 12:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。

2227) fix/shape/step5-stage-progress-dark-grey (P1) — 完了 (2026-01-17)
- ブランチ名: fix/shape/step5-stage-progress-dark-grey
- 依存: なし
- 受け入れ基準: Step5 のステージ稼働なし時のCircularProgressが dark テーマでより黒に近い暗い灰色になる／light テーマの表示は維持される／稼働中の表示ロジックは既存のまま／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`
- ロールバック手順: 該当差分を revert し、dark テーマの色を修正前に戻す
- チェックリスト:
  - dark テーマ時の稼働なし色を調整する
  - light テーマが維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 09:11 JST Step5 稼働なしの dark テーマ灰色調整に着手。
  - update: 2026-01-17 09:12 JST BuildStepStagePanel の dark テーマ用 grey を暗めに調整。
  - blocked: 2026-01-17 09:12 JST pnpm typecheck が @hierarchidb/ui-map の既存型エラーで失敗（ResourceLayerMap.tsx の minLng/minLat/maxLng/maxLat, MapHoverCandidate 型, MapPreviewSearchPanelProps, jotai Store）。
  - done: 2026-01-19 12:50 JST 実装済みのため完了へ変更（再検証は未実施）。

2221) feat/shape/step6-preview-layout (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/step6-preview-layout
- 依存: なし
- 受け入れ基準: Step6 のタブUIが廃止され、DialogContent直下で地図プレビューが常時表示される／フィーチャー一覧とエラー内容が統合されたフローティングダイアログが地図上に表示され、エラー有無で Failed/Completed のChipが出る／選択/検索/エラーLineStringのハイライトが破綻しない／モバイル/デスクトップでレイアウトが崩れない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 のタブ構成と一覧表示を修正前へ戻す
- チェックリスト:
  - Step6 のタブUIを撤去する
  - 地図プレビューをDialogContent直下で常時表示する
  - フローティングダイアログでフィーチャー一覧とエラー内容を統合表示する
  - エラー有無でFailed/CompletedのChipを表示する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:00 JST Step6 のタブ撤去とプレビュー/一覧統合表示に着手。
  - update: 2026-01-18 19:25 JST Step6 プレビューのタブ撤去と地図常時表示、フローティング一覧統合の実装に着手。
  - blocked: 2026-01-18 19:30 JST pnpm typecheck が packages/ui/map の ResourceLayerMap bounds 型推論と jotai Store import で失敗。
  - update: 2026-01-18 19:40 JST ui-map/plugin-service-api の dist を再ビルドし、Step6 プレビューのフローティング一覧を一本化。
  - update: 2026-01-18 19:41 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 19:41 JST Step6 のタブ廃止とフローティング一覧統合、地図常時表示を完了。

2228) refactor/ui-map/shape-preview-floating-table (P1) — 進行中 (2026-01-18)
- ブランチ名: refactor/ui-map/shape-preview-floating-table
- 依存: なし
- 受け入れ基準: ui-map にフローティングの一覧コンポーネントが追加される／Step6 が ui-map の共通コンポーネントを利用してフィーチャー一覧を描画し、エラー統合列の生成は ui-map 側へ寄せられる／検索/選択/ハイライトが維持される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/preview/**`, `packages/ui/map/src/index.ts`, `packages/ui/map/package.json`, `plugins/shape-plugin/src/ui/components/step6/**`（必要に応じて）
- ロールバック手順: ui-map のフローティング一覧コンポーネントと Step6 側の差分を revert し、shape-plugin 側の個別実装へ戻す
- チェックリスト:
  - ui-map にフローティングの一覧コンポーネントを追加する
  - エラー統合列の生成ロジックを ui-map 側へ移す
  - Step6 を ui-map の共通コンポーネントへ切り替える
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 20:00 JST ui-map のフローティング一覧共通化と Step6 切り替えに着手。
  - blocked: 2026-01-18 20:05 JST pnpm install が registry 参照/EPERM symlink で失敗（getaddrinfo ENOTFOUND registry.npmjs.org）。
  - update: 2026-01-18 20:10 JST ui-map のフローティング一覧コンポーネントを追加し、Step6 の一覧表示を共通化へ切替。
  - update: 2026-01-18 20:16 JST pnpm --filter @hierarchidb/ui-map build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 20:17 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 20:25 JST ステータス列を Chip 表示へ戻し、ui-map build/typecheck を再実行。
  - done: 2026-01-18 20:26 JST ui-map 側へ一覧/エラー列統合を寄せ、Step6 の共通化を完了。

2220) feat/shape/transform-exclusion-ui (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/shape/transform-exclusion-ui
- 依存: なし
- 受け入れ基準: Step4 Transform の「面積フィルター」カードがUIから撤去される／「除外ポリゴン面積係数」の入力UIがStep4 Transformに配置され、保存・再読込される／既存のTransform設定レイアウトが破綻しない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/TransformConfigSection.tsx`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Transform 設定のカード構成を修正前に戻す
- チェックリスト:
  - 面積フィルターカードをTransform設定から撤去する
  - 除外ポリゴン面積係数のUIを配置する
  - 保存/再読込が維持されることを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:40 JST Step4 Transform の面積フィルター撤去と係数UI追加に着手。
  - update: 2026-01-18 18:45 JST 面積フィルターカードを撤去し、係数スライダーを Transform 設定へ移設。
  - update: 2026-01-18 18:46 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:47 JST 面積フィルター撤去と係数UIの再配置を完了。

2221) fix/shape/step6-error-list-count-format (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-count-format
- 依存: なし
- 受け入れ基準: Step6 エラー一覧からソースキー列を削除する／ポリゴン/リングの表示が「エラー数/総数」形式になる／既存のソート/検索/選択が破綻しない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/vt-orchestrator/src/transform/**`, `packages/plugin-service-api/src/types/**`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 エラー一覧の列構成と数値表示を修正前に戻す
- チェックリスト:
  - エラー一覧からソースキー列を削除する
  - ポリゴン/リングの表示をエラー数/総数に更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 17:35 JST Step6 エラー一覧の列削除とエラー数/総数表示に着手。
  - blocked: 2026-01-18 17:45 JST pnpm typecheck が vt-orchestrator build:types の ShapeTransformErrorRecord に polygonErrorCount/ringErrorCount が未反映で失敗。
  - update: 2026-01-18 17:50 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 17:55 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:00 JST エラー一覧の列削除とエラー数/総数表示を完了。

2222) fix/shape/exclude-area-default (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/exclude-area-default
- 依存: なし
- 受け入れ基準: excludePolygonAreaCoefficient のデフォルトが常に 1.0 になる（テンプレート由来でも 0 にならない）／既存の設定値を壊さない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `plugins/shape-plugin/src/worker/api.ts`, `app/public/templates/population-2023/tree-nodes.json`（必要に応じて）
- ロールバック手順: 該当差分を revert し、係数デフォルトとテンプレートの設定を修正前に戻す
- チェックリスト:
  - テンプレートの buildConfig に係数デフォルトを反映する
  - 既存 buildConfig の不足値にデフォルトを補完する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:20 JST excludePolygonAreaCoefficient のデフォルト補正に着手。
  - update: 2026-01-18 18:30 JST テンプレートと buildConfig 初期化で係数デフォルトを 1.0 に補正。
  - update: 2026-01-18 18:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 18:40 JST テンプレート由来でも係数が 1.0 で初期化されることを確認。

2219) feat/shape/transform-area-exclusion (P1) — 完了 (2026-01-18)
- ブランチ名: feat/shape/transform-area-exclusion
- 依存: なし
- 受け入れ基準: Transform の簡易化前処理でポリゴンごとにアウトライン総延長と面積を算出し、`area < coefficient * gridSize * outlineLength / 2` の場合に除外される／係数はデフォルト1で「除外ポリゴン面積係数」として Step4 UI に追加される／設定値が保存・再読込され、transform 処理へ反映される／除外対象はエラー扱いにならず通常のフィルタとして処理される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/**`, `packages/vt-orchestrator/src/transform/**`, `packages/features/gis-sdk/src/types/**`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Transform 設定の係数追加と面積除外の前処理を修正前に戻す
- チェックリスト:
  - Transform 設定に「除外ポリゴン面積係数」を追加する
  - 係数の保存/再読込が既存設定と同様に機能することを確認する
  - transform の簡易化前処理で面積/アウトライン総延長の除外判定を実装する
  - 除外はエラー扱いにならないことを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 18:05 JST Transform 簡易化前の面積除外係数追加対応に着手。
  - blocked: 2026-01-18 18:12 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig に excludePolygonAreaCoefficient が未反映で失敗。
  - update: 2026-01-18 18:13 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 18:14 JST pnpm typecheck を実行（exit 0）。
  - blocked: 2026-01-18 18:18 JST pnpm typecheck が vt-orchestrator の simplifyFeatureCollection 引数順で失敗。
  - update: 2026-01-18 18:20 JST simplifyFeatureCollection の引数を required 型に整理し、pnpm typecheck を再実行（exit 0）。
  - done: 2026-01-18 18:22 JST 係数設定の追加と transform 前処理の面積除外を実装し、typecheck が通ることを確認。

2219) fix/shape/step6-error-list-admin-names (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-admin-names
- 依存: なし
- 受け入れ基準: Step6 エラー一覧に Admin0 名（国名）と Admin1/2 名（地域名）を表示する／列追加に伴うソート・検索・表示崩れがない／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、エラー一覧の列構成を修正前に戻す
- チェックリスト:
  - エラー一覧へ Admin 名の列を追加する
  - 表示ラベル（日本語/英語）を更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 17:05 JST Step6 エラー一覧の Admin 名表示対応に着手。
  - update: 2026-01-18 17:15 JST Admin0/1/2 名の列を追加し、ラベルを更新。
  - update: 2026-01-18 17:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 17:25 JST Step6 エラー一覧に Admin 名を表示できることを確認。

2224) analysis/shape/step5-transform-simplify-errors (P1) — 進行中 (2026-01-18)
- ブランチ名: analysis/shape/step5-transform-simplify-errors
- 依存: なし
- 受け入れ基準: Step5 Transform の処理順（自己交差分割→面積フィルタ→簡易化）の有無を実装で確認する／transform failed: geometry simplify error の主因候補を根拠付きで整理する／事前フィルタで抑制できる条件を提案し、エラーゼロ化への方針を示す
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `plugins/shape-plugin/src/worker/**`（調査後に確定）
- ロールバック手順: 調査のみのため不要（変更が発生した場合は差分を revert）
- チェックリスト:
  - Step5 Transform の処理順と実装箇所を特定する
  - geometry simplify error の主因候補を列挙し根拠を示す
  - 事前フィルタで抑制する方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:15 JST Step5 Transform の処理順と簡易化エラー原因の調査に着手。
  - update: 2026-01-18 19:25 JST vt-orchestrator の createTransformByBandHandler/simplifyFeatureCollection で処理順と簡易化例外の出力内容を確認。
  - done: 2026-01-18 19:30 JST Step5 Transform の現状整理と事前フィルタ方針の提案をまとめた。

2225) fix/shape/transform-zero-polygons-success (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/shape/transform-zero-polygons-success
- 依存: なし
- 受け入れ基準: Transform ステージで simplified.features.length===0 を失敗扱いにしない／ビルド全体の失敗判定を「失敗タスク数 > 0」で行う／ゼロポリゴンの地物は地図に出ないが一覧に 0/0 で残る挙動が維持される／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/vt-orchestrator/src/transform/**`, `packages/runtime-worker/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Transform の失敗判定とビルド失敗判定を修正前に戻す
- チェックリスト:
  - simplified.features.length===0 の失敗判定を撤廃する
  - 失敗タスク数 > 0 をビルド失敗判定に用いるよう修正する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:40 JST ゼロポリゴン時の成功扱いとビルド失敗判定の修正に着手。
  - update: 2026-01-18 20:05 JST transform の simplified features empty を失敗扱いから除外。
  - update: 2026-01-18 20:20 JST ui-map/plugin-service-api の dist を更新（pnpm --filter @hierarchidb/ui-map build / pnpm --filter @hierarchidb/plugin-service-api build）。
  - update: 2026-01-18 20:25 JST app の modeless dialog で mapLayerInfoAtom の参照先を修正し MapNodeType ガードを追加。
  - update: 2026-01-18 20:30 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 20:31 JST ゼロポリゴン時の成功扱いとビルド失敗判定の前提を反映。

2223) chore/shape/template-buildconfig-default-audit (P1) — 進行中 (2026-01-18)
- ブランチ名: chore/shape/template-buildconfig-default-audit
- 依存: なし
- 受け入れ基準: app/public/templates 配下の buildConfig を棚卸しし、excludePolygonAreaCoefficient が欠落/非数のテンプレートを特定する／必要なテンプレートに excludePolygonAreaCoefficient: 1.0 を追記する／差分が最小である／pnpm typecheck が exit 0 で完走する
- 影響範囲: `app/public/templates/**`（必要に応じて）
- ロールバック手順: 該当差分を revert し、テンプレートの buildConfig を修正前に戻す
- チェックリスト:
  - テンプレートの buildConfig を棚卸しして不足/非数の箇所を記録する
  - 必要なテンプレートに excludePolygonAreaCoefficient: 1.0 を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 19:05 JST テンプレートの buildConfig 棚卸しに着手。
  - update: 2026-01-18 19:06 JST app/public/templates を棚卸しし、buildConfig は population-2023 のみ、excludePolygonAreaCoefficient=1 を確認。
  - update: 2026-01-18 19:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 19:11 JST テンプレートの係数デフォルト棚卸しを完了。

2218) fix/shape/step6-error-list-visuals-fit-screen (P1) — 完了 (2026-01-18)
- ブランチ名: fix/shape/step6-error-list-visuals-fit-screen
- 依存: なし
- 受け入れ基準: Step6 エラー一覧の1行がフィーチャー単位であることを確認し記録する／エラー一覧から記録日時カラムを削除し、ポリゴン/リングのエラー数が表示される／エラー一覧の行選択状態で地図プレビューのエラーLineStringが primary 色＋光彩で強調され、未選択は従来の error 色で表示される／選択行のフォント色が primary になる／Step6 地図プレビューに FitScreen ボタンを追加し、選択中地物の最小BBoxへ移動する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `plugins/shape-plugin/src/ui/locales/*`（必要に応じて）
- ロールバック手順: 該当差分を revert し、Step6 エラー一覧の列構成/選択表示/地図プレビューの強調表示/FitScreen 表示を修正前に戻す
- チェックリスト:
  - エラー一覧の1行がフィーチャー単位である根拠を確認する
  - エラー一覧の列構成を更新し、記録日時を削除する
  - 行選択状態でのエラーLineStringの表示色を切り替える
  - 行選択時のフォント色を primary に更新する
  - Step6 地図プレビューに FitScreen を追加し選択BBoxへ移動できるようにする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 16:20 JST Step6 エラー一覧/地図プレビュー/FitScreen 対応に着手。
  - update: 2026-01-18 16:30 JST createTransformByBandHandler で errorRecords を feature 単位に生成していることを確認。
  - update: 2026-01-18 16:40 JST エラー一覧の列構成/選択色/地図プレビューの選択強調/FitScreen を実装。
  - update: 2026-01-18 16:45 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 16:50 JST Step6 エラー一覧/地図プレビュー/FitScreen の要件を満たしたことを確認。

2217) fix/runtime-worker/shape-transform-cache-typecheck (P1) — 完了 (2026-01-18)
- ブランチ名: fix/runtime-worker/shape-transform-cache-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の ShapeMutationService/ShapeQueryService/WorkerService における ShapeTransformCache 不整合の型エラーが解消される／原因・影響範囲・修正内容を説明できる／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/runtime-worker/src/**`, `packages/plugin-service-api/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、runtime-worker と plugin-service-api の型定義/実装を修正前に戻す
- チェックリスト:
  - runtime-worker の ShapeTransformCache 関連型エラーの原因を特定する
  - 影響範囲を整理し、必要最小限の修正を行う
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 15:20 JST runtime-worker の ShapeTransformCache 系 typecheck エラー修正に着手。
  - update: 2026-01-18 15:30 JST plugin-service-api の dist 型定義を再生成し、runtime-worker の型参照を最新化。
  - update: 2026-01-18 16:05 JST shape-plugin の getNumCaches 型不整合の修正に着手。
  - update: 2026-01-18 16:10 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 16:12 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 16:15 JST runtime-worker/shape-plugin の typecheck が通り、ShapeTransformCache 系エラーが解消されたことを確認。

2216) fix/ui/dialog-footer-next-click (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/ui/dialog-footer-next-click
- 依存: なし
- 受け入れ基準: プラグインダイアログを最大化した状態でもフッター右下の「次へ」がクリックできる／SpeedDial などの重なり要因が特定され、対処が反映されている／通常サイズや他ダイアログの操作性が維持される
- 影響範囲: `packages/plugin-ui-host/src/**`, `app/src/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ダイアログフッターのレイアウト/重なり制御を修正前に戻す
- チェックリスト:
  - 最大化時に「次へ」がクリックできない原因（重なり要素/レイヤー）を特定する
  - クリック可能になるよう最小差分で修正する
  - 通常サイズ/他ダイアログの挙動を確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 14:10 JST プラグインダイアログ最大化時に「次へ」が押せない問題の調査に着手。
  - update: 2026-01-18 14:20 JST 最大化時にリサイズハンドルを描画しないよう調整し、フッター右下のクリック阻害を回避する対応を追加。
  - blocked: 2026-01-18 14:25 JST pnpm typecheck が @hierarchidb/vt-orchestrator build:types の TransformByBandCacheRecord に bandId が無い型エラー（createTransformByBandHandler.ts:868）で失敗。
  - update: 2026-01-18 14:40 JST ダイアログ表示時に SpeedDial を確実に抑制するため、hash ルーティング時の dialog route 判定を追加。
  - blocked: 2026-01-18 14:45 JST pnpm typecheck が @hierarchidb/runtime-worker の EphemeralShapeDB/TransformByBandCacheRecord/TransformByZoomCacheRecord 型エラー（ShapeMutationService.ts/ShapeQueryService.ts/vectorTileStageRunner.ts）で失敗。
  - update: 2026-01-18 15:05 JST ダイアログ表示中は SpeedDial を強制的に非表示にするため、PluginDialogFrame が dialog-open 共有状態を通知し DynamicSpeedDial がそれに追従するよう調整。
  - blocked: 2026-01-18 15:10 JST pnpm typecheck が @hierarchidb/runtime-worker の ShapeMutationService/ShapeQueryService/WorkerService における ShapeTransformCache 不整合で失敗。
  - update: 2026-01-18 15:15 JST maximize/full-screen 時のリサイズハンドル非表示は維持する方針を確定。

2214) feat/ui-map/fit-screen-button (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/ui-map/fit-screen-button
- 依存: なし
- 受け入れ基準: ui-map に FitScreen アイコンボタンが表示される（デフォルトON）／選択フィーチャーが0件のときはボタンが disabled になる／ボタン押下で選択フィーチャー全体のバウンディングボックスを算出し、最小フィットの視野へ遷移する／既存の地図操作に副作用がない
- 影響範囲: `app/src/**` `packages/**`（調査後に確定）
- ロールバック手順: 追加したボタン表示とフィット処理の差分を revert し、ui-map のツールバーとカメラ制御を修正前に戻す
- チェックリスト:
  - FitScreen ボタンの表示条件と disabled 条件を追加する
  - 選択フィーチャーのバウンディングボックス算出処理を実装する
  - BBox から最小フィット視野へ遷移する処理を実装する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 12:00 JST ui-map FitScreen ボタン表示と選択フィーチャーのフィット表示対応に着手。
  - update: 2026-01-18 12:05 JST FitScreen ボタン表示/disabled 条件と選択フィーチャーの fitBounds 処理を実装。
  - blocked: 2026-01-18 12:10 JST pnpm typecheck が @hierarchidb/shape-store build:types の ShapeTransformErrorRecord 未export で失敗。
  - update: 2026-01-18 12:20 JST FitScreen ボタン位置を map 右上コントロール直下へ移動し、outline アイコンボタンで表示する対応に着手。
  - update: 2026-01-18 12:30 JST FitScreen ボタン位置変更と outline 表示を反映。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 13:10 JST Shape Step6 の FitScreen ボタンを map 右上コントロール直下に移動し、outline 表示へ統一。
  - blocked: 2026-01-18 13:15 JST pnpm typecheck が vt-orchestrator の polygonErrorCount 型エラーで失敗。
  - update: 2026-01-18 13:30 JST Shape Step6 FitScreen の位置を top-right コントロール下端 +16px で再計算。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 13:50 JST エラー一覧選択でも FitScreen を有効化し、ボタンを size=large/variant=outlined に変更。
  - update: 2026-01-18 14:10 JST エラー選択の境界算出を追加し、FitScreen を有効化。pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 14:25 JST FitScreen ボタンの margin 4px と高さ 32px を反映。pnpm typecheck を実行（exit 0）。

2218) feat/ui-map/interaction-core-unify (P1) — 進行中 (2026-01-18)
- ブランチ名: feat/ui-map/interaction-core-unify
- 依存: なし
- ExecPlan: `plans/ui-map-interaction-core-execplan.md`
- 受け入れ基準: ui-map の基本機能として FitScreen/検索フィールド/hover/selection/search/ハイライト/スナックバー/矩形選択/Enter検索fit が統合され、props で有効/無効を切替できる／Step6 プレビューが ui-map の基本機能へ移行する／Transform エラーの永続化内容がエラー一覧表示に必要な情報を漏れなく含む／エラー一覧の国名・大陸名が ISO-3166-2 から補完される／ポリゴン・リングのエラー/総数が正確に表示される／エラー一覧の行選択で地図が自動フィットする／pnpm typecheck が成功する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `packages/vt-orchestrator/src/transform/**`, `packages/plugin-service-api/src/types/**`（調査後に確定）
- ロールバック手順: ui-map 統合機能と Step6 変更、Transform エラー永続化の差分を revert し、従来の個別実装へ戻す
- チェックリスト:
  - ui-map の基本機能として 1〜6 を統合し、props で有効/無効を切替可能にする
  - Step6 プレビューを ui-map の統合機能へ移行する
  - Transform エラーの永続化項目を拡充し Step6 で表示する
  - ISO-3166-2 で国名/大陸名を補完する
  - エラー/総数の表示を正確化する
  - エラー一覧選択時に地図を自動フィットする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 14:45 JST ui-map 基本機能の統合と Step6 エラー表示拡充に着手。
  - update: 2026-01-18 14:20 JST FitScreen ボタンの margin 4px と高さ 32px を反映。
  - update: 2026-01-18 12:55 JST shape Step6 プレビューの FitScreen ボタン位置修正に着手。
  - update: 2026-01-18 18:40 JST ui-map を FitScreen/検索/選択/hover/ハイライト/矩形選択/検索fit の基本機能として統合し、Step6 プレビューも ui-map 基本機能へ移行する方針を反映。
  - update: 2026-01-17 12:31 JST フローティングウィンドウのタイトルバー/ボディの詰め調整とボタン構成の整理、Grid検索欄の重複整理に着手。
  - update: 2026-01-17 12:32 JST pnpm --filter @hierarchidb/ui-grid build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:33 JST pnpm --filter @hierarchidb/ui-floating-window build を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 12:34 JST pnpm typecheck が app の PluginDialogRoute.tsx で pathOnly/normalizedPath 未確定の型エラーで失敗。
  - update: 2026-01-17 12:35 JST PluginDialogRoute.tsx の pathOnly 取得を空文字フォールバックに整理。
  - update: 2026-01-17 12:36 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:35 JST フローティングウィンドウのドラッグ開始時に z-index を引き上げる処理を追加。
  - update: 2026-01-17 12:36 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:37 JST Fit ボタンのアイコンが消える問題に対応し、maplibre のクラス付与を外して表示を優先。
  - update: 2026-01-17 12:38 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:38 JST MapPreviewFloatingTable の GenericDataGrid に showSearch=false を明示し検索欄の重複を解消。
  - update: 2026-01-17 12:39 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:44 JST 件数のテキスト表示をやめ、タイトルに件数を含める表示へ変更。
  - update: 2026-01-17 12:45 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:51 JST メタデータ検索欄にルーペ/クリアアイコンと丸み最大の形状を適用。
  - update: 2026-01-17 12:52 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:20 JST 検索欄のルーペアイコン左側に 16px の余白を追加。
  - update: 2026-01-17 13:21 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:31 JST 検索欄右側にカラム選択メニューを追加し、表示カラムの切替に対応。
  - update: 2026-01-17 13:32 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。

2217) fix/app/ui-treeconsole-workspace-dep (P1) — 進行中 (2026-01-18)
- ブランチ名: fix/app/ui-treeconsole-workspace-dep
- 依存: なし
- 受け入れ基準: app の依存から存在しない `@hierarchidb/ui-treeconsole` を解消し、pnpm install が成功する／必要なら import 参照を実在パッケージへ修正する／TASKS.md に運用ログを記載する
- 影響範囲: `app/package.json` ほか（調査後に確定）
- ロールバック手順: 依存の差分を revert し、元の依存定義に戻す
- チェックリスト:
  - app/package.json の `@hierarchidb/ui-treeconsole` 依存を削除/置換する
  - 必要なら import を実在パッケージに修正する
  - pnpm install を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 12:40 JST app 依存の @hierarchidb/ui-treeconsole 解消対応に着手。
  - blocked: 2026-01-18 12:45 JST pnpm install が pnpm store への symlink で EPERM により失敗。
  - update: 2026-01-18 12:46 JST pnpm install を昇格実行し成功（lockfile 変更なし）。

2215) chore/shape/ephemeral-table-audit (P1) — 進行中 (2026-01-18)
2216) chore/shape/shape-db-table-audit (P1) — 進行中 (2026-01-18)
- ブランチ名: chore/shape/shape-db-table-audit
- 依存: なし
- 受け入れ基準: hdb-shape の全テーブルについて読み書き参照箇所を整理する／未使用または重複の疑いがあるテーブルを根拠付きで提示する／削除/統合/保留の方針と影響範囲を提示する／削除/統合を提案する場合はロールバック手順と移行手順を明記する／TASKS.md に調査ログを記載する
- 影響範囲: `packages/features/shape-store/src/ShapeDB.ts` ほか（調査後に確定）
- ロールバック手順: 調査のみの場合は不要。実装する場合は該当差分を revert し、hdb-shape のテーブル構成を元に戻す
- チェックリスト:
  - hdb-shape の全テーブルと参照箇所（読み書き）を洗い出す
  - 未使用/重複が疑われるテーブルの削除/統合/保留方針を提示する
  - ロールバックと移行手順の方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 16:10 JST hdb-shape のテーブル利用状況調査に着手。
  - update: 2026-01-18 17:20 JST hdb-shape の featureIndices テーブル撤去対応に着手。
  - update: 2026-01-18 17:35 JST featureIndices テーブル定義を削除し、ShapeDB のスキーマを v5 に更新。
  - update: 2026-01-18 17:40 JST pnpm --filter @hierarchidb/shape-store typecheck を実行（exit 0）。
  - update: 2026-01-18 17:41 JST pnpm --filter @hierarchidb/shape-store build を実行（exit 0、tsdown define 警告あり）。

- ブランチ名: chore/shape/ephemeral-table-audit
- 依存: なし
- 受け入れ基準: shape-ephemeral の全テーブルについて読み書き参照箇所を整理する／transformByBandCache/transformByZoomCache/transformByZoomReservations/vtCache の用途・重複・未使用の有無を根拠付きで説明する／未使用または重複の疑いがあるテーブルについて削除/統合/保留の方針と影響範囲を提示する／削除/統合を提案する場合はロールバック手順と移行手順を明記する／TASKS.md に調査ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts` ほか（調査後に確定）
- ロールバック手順: 調査のみの場合は不要。実装する場合は該当差分を revert し、shape-ephemeral のテーブル構成を元に戻す
- チェックリスト:
  - shape-ephemeral の全テーブルと参照箇所（読み書き）を洗い出す
  - transformByBandCache/transformByZoomCache/transformByZoomReservations/vtCache の用途・重複・未使用の有無を整理する
  - 未使用/重複が疑われるテーブルの削除/統合/保留方針を提示する
  - ロールバックと移行手順の方針を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-18 13:30 JST shape-ephemeral のテーブル利用状況調査に着手。
  - update: 2026-01-18 14:05 JST shape-ephemeral のテーブル参照箇所を洗い出し、未使用/重複の疑いを整理。
  - update: 2026-01-18 15:20 JST transformByBandCache→transformCache の改名、未使用テーブル削除、tileIdToBufferRelations の転置インデックス実装に着手。
  - update: 2026-01-18 15:35 JST pnpm --filter @hierarchidb/gis-sdk typecheck を実行（exit 0）。
  - update: 2026-01-18 15:36 JST pnpm --filter @hierarchidb/shape-store typecheck を実行（exit 0）。
  - update: 2026-01-18 15:37 JST pnpm --filter @hierarchidb/vt-shape-store typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:38 JST pnpm --filter @hierarchidb/plugin-service-api typecheck が ShapeTransformCache 未export で失敗。
  - update: 2026-01-18 15:40 JST plugin-service-api の型名修正と typecheck を実行（exit 0）。
  - update: 2026-01-18 15:41 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:43 JST pnpm --filter @hierarchidb/runtime-worker typecheck が ShapeMutationAPI 差分で失敗。
  - update: 2026-01-18 15:45 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:47 JST pnpm --filter @hierarchidb/runtime-worker typecheck を実行（exit 0）。
  - blocked: 2026-01-18 15:50 JST pnpm --filter @hierarchidb/shape-plugin typecheck が getNumCaches 型差分で失敗。
  - update: 2026-01-18 15:52 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:53 JST pnpm --filter @hierarchidb/shape-store build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 15:55 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2213) feat/shape/step4-zoom-band-accordion-layout (P1) — 進行中 (2026-01-17)
- ブランチ名: feat/shape/step4-zoom-band-accordion-layout
- 依存: なし
- 受け入れ基準: Step4 のズーム帯範囲カードが horizontal/vertical をプロパティで切替できる／ズーム帯範囲カードと共通ズーム帯反映ボタンが Transform アコーディオンから 0 番目の新規アコーディオンへ移設される／0 番目アコーディオンのサマリーにルーペアイコンと「ズーム帯の設定」見出しが表示される／0 番目アコーディオンのディティールでズーム帯範囲カードが horizontal で表示される／既存挙動が壊れない
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step4 のアコーディオン構成とズーム帯カード配置を修正前に戻す
- チェックリスト:
  - Step4 のズーム帯範囲カードに並び方向プロパティを追加する
  - ズーム帯範囲カード/共通ズーム帯反映ボタンを新規アコーディオンへ移設する
  - 新規アコーディオンのサマリーにルーペアイコンと見出しを表示する
  - ディティールでズーム帯範囲カードを horizontal 表示にする
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-17 22:10 JST Step4 ズーム帯範囲カードの配置変更と並び方向切替対応に着手。
  - update: 2026-01-17 22:30 JST ズーム帯設定アコーディオンの追加とカード/ボタン移設、カードの並び方向切替を実装。
  - update: 2026-01-17 22:35 JST pnpm typecheck を実行（初回 timeout のため再実行、exit 0）。
  - update: 2026-01-17 22:45 JST ズーム帯の範囲設定カード内スライダー水平配置の gap 調整に着手。
  - update: 2026-01-17 22:50 JST ズーム帯の範囲設定カード内の水平スライダー間隔を 16px に調整。
  - update: 2026-01-17 23:20 JST ズーム帯設定/キャッシュ管理の見出し更新、即時削除カードの移設、ズーム帯説明をツールチップ化。
  - blocked: 2026-01-17 23:25 JST pnpm typecheck が plugins/shape-plugin/src/worker/api.ts の既存エラーで失敗。
  - update: 2026-01-17 23:35 JST ズーム帯スライダー間隔を margin 指定で 16px 相当に調整。
  - update: 2026-01-17 23:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-17 23:55 JST Fetch設定のアコーディオン見出しからキャッシュ管理表記を削除。
  - update: 2026-01-18 00:05 JST ズーム帯設定/キャッシュ管理の表記にスペースを追加し、設定アイコンに変更。
  - update: 2026-01-18 00:20 JST 中間生成物の保持カードをズーム帯設定へ移設し、Fetch設定の見出しを更新。
  - update: 2026-01-18 00:25 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 00:40 JST ズーム帯スライダー間隔を Grid の columnSpacing=2 で確実に確保。
  - update: 2026-01-18 00:45 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 00:55 JST ズーム帯スライダー間に 16px のスペーサー Grid を追加。
  - update: 2026-01-18 01:00 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 01:10 JST ズーム帯スライダー間を Grid アイテムの左右 padding で 16px 確保。
  - update: 2026-01-18 01:15 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-18 01:30 JST ズーム帯スライダー間の左右 padding を 16px に調整。
  - update: 2026-01-18 01:35 JST Fetch設定のレイアウトを 1/3+1/6*4 に変更し、リトライ最大5回に制限。
  - update: 2026-01-18 02:10 JST ズーム帯スライダー間隔を Grid の columnSpacing で 16px に調整する対応に着手。
  - update: 2026-01-18 02:12 JST ズーム帯スライダー間を columnSpacing=2（16px）で確保。
  - update: 2026-01-18 02:20 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 02:45 JST Step4 Transform の面積フィルター設定が Transform ステージ処理で利用されているかを調査。
  - update: 2026-01-18 02:55 JST Transform アコーディオンからズーム帯の一覧カードを削除。
  - update: 2026-01-18 03:10 JST Transform ステージの面積フィルター適用を無効化。
  - update: 2026-01-18 03:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 03:45 JST geometry simplify error の features/polygons 表記を invalidFeatures/invalidPolygons に改名。
  - update: 2026-01-18 04:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 04:25 JST TransformConfig を ringFix/selfIntersection の階層化と係数設定に合わせて更新。
  - update: 2026-01-18 05:15 JST Transform の簡略化前に ringFix/selfIntersection を適用する処理を追加。
  - blocked: 2026-01-18 05:30 JST pnpm typecheck が vt-orchestrator の Geometry 修正に伴う型エラーで失敗。
  - update: 2026-01-18 05:40 JST vt-orchestrator の Geometry 修正を反映し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 06:05 JST pnpm install --frozen-lockfile が pnpm store への symlink で EPERM により失敗（sandbox 制限）。
  - blocked: 2026-01-18 06:10 JST CI=true pnpm install --frozen-lockfile --store-dir .pnpm-store が registry ENOTFOUND と store 内容不一致（@turf/simplify）で失敗。
  - blocked: 2026-01-18 06:15 JST pnpm build が dep-fence 未解決（node_modules 未整備）で失敗。
  - blocked: 2026-01-18 06:20 JST pnpm typecheck が turbo 未導入（node_modules 未整備）で失敗。
  - update: 2026-01-18 06:55 JST pnpm build を実行（exit 0、eslint-plugin-storybook 無効化の警告あり）。
  - update: 2026-01-18 07:00 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 07:05 JST pnpm test が resolver-plugin の import 失敗（~/worker/ResolverEntityService.ts）、runtime-worker の util dist 参照不一致（format.js 不在）、styler-plugin の setup.ts 不在で失敗。
  - start: 2026-01-18 07:15 JST pnpm test の resolver-plugin/util/styler-plugin 失敗を修正する作業に着手。
  - update: 2026-01-18 07:35 JST pnpm test の残存失敗（basemap/styler の ui-i18n / ui-worker-client 解決）に対応する作業に着手。
  - blocked: 2026-01-18 11:25 JST pnpm test が runtime-worker（import-export/auth-recovery の dist 解決で Class extends undefined）、shape-plugin（gen-iso3166-2/browser 未解決、useBuildProgress パス不整合）で失敗。
  - blocked: 2026-01-18 04:40 JST pnpm typecheck が gis-sdk の dist 型未更新で失敗。
  - update: 2026-01-18 04:45 JST pnpm --filter @hierarchidb/gis-sdk build を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 04:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 01:40 JST pnpm typecheck を実行（exit 0）。
  - update: 2026-01-16 08:16 JST Fetch設定アコーディオンのサマリー文言を「Fetch設定」へ変更。
  - update: 2026-01-16 08:16 JST pnpm build を実行（exit 0）。
  - blocked: 2026-01-16 08:16 JST pnpm typecheck が @hierarchidb/vt-orchestrator の BuildTaskType あエラーで失敗（packages/vt-orchestrator/src/types/_BuildConfig.ts）。
  - update: 2026-01-16 11:37 JST pnpm test の残存失敗が location-plugin のテストであることを確認し、修正に着手。
  - update: 2026-01-16 11:56 JST pnpm test の app テスト失敗（worker preload/maplibre）対応に着手。
  - update: 2026-01-18 08:40 JST ズーム帯スライダー間隔の 16px padding 適用と Fetch 設定レイアウト/リトライ上限調整に着手。
  - blocked: 2026-01-18 08:45 JST pnpm --filter @hierarchidb/shape-plugin typecheck が utils.ts の DataSourceName 型エラー（TS2322）で失敗。
  - update: 2026-01-18 08:50 JST utils.ts の buildConfig 正規化を修正し、pnpm --filter @hierarchidb/shape-plugin typecheck を再実行（exit 0）。
  - update: 2026-01-18 09:05 JST 再ビルド時に fetch タスクを再利用しないよう fetch ステージの旧タスク削除を追加し、pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 09:15 JST Step5 fetch タスク数が実行中に増殖し続ける問題の調査と修正に着手。
  - update: 2026-01-18 09:35 JST fetch ステージの進捗カウントをタスク数ベースに切り替え、表示単位をタスク/ポリゴンで切替。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:05 JST transform タスクの outputData に処理済み/総ポリゴン数を書き込み、タスク進捗をポリゴン比率で算出。サマリーはタスク件数集計へ切替。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:20 JST transform ステージのサマリー進捗バーを fetch URL 数ベースに変更（ステージ単体表示時のみ）。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 10:40 JST Step4 の削除ボタン件数を fetch cache 数へ合わせ、削除ラベルの件数表記を i18n 化。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:00 JST Step4 の Transform 削除件数を fetch×ズーム帯数で算出し、Transform タスクタイトルに ADM レベルとズーム帯範囲を表示。pnpm --filter @hierarchidb/vt-orchestrator typecheck / pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:10 JST Transform 完了タスクのメッセージに Features/Polygons/Geometries を表示。pnpm --filter @hierarchidb/vt-orchestrator typecheck（exit 0）。
  - update: 2026-01-18 11:25 JST 進捗バーのセグメント幅をタスク件数ベースに統一し、transform 単体は fetch タスクで描画。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:40 JST Transform 削除件数を taskQueue の transform タスク件数に合わせ、削除後に 0 へ更新されるよう修正。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 11:55 JST 進捗サマリーの SVG が灰色になる問題に対応し、success/error/process の状態も色分け対象に追加。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - update: 2026-01-18 12:10 JST success/error/process を completed/failed/running に統一し、タスク表記の状態を正規化。pnpm --filter @hierarchidb/shape-plugin typecheck（exit 0）。
  - start: 2026-01-18 12:20 JST Transform進捗サマリーSVGが灰色のままになる問題の再調査に着手。
  - update: 2026-01-18 12:35 JST transform-by-zoom のタスクを transform ステージへ集約するマッピングを追加。
  - update: 2026-01-18 12:40 JST pnpm --filter @hierarchidb/ui-batch-progress typecheck を実行（exit 0）。
  - update: 2026-01-18 12:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。
  - update: 2026-01-18 12:50 JST transform-by-zoom→transform のステージ集約マッピングを撤去。
  - start: 2026-01-18 13:05 JST Transform進捗サマリーの灰色表示を調査するため tasksByStage のステージキー/状態内訳ログを追加する対応に着手。
  - update: 2026-01-18 13:10 JST ShapeBuildProgressPanel に tasksByStage のステージキー/状態内訳ログを追加。
  - update: 2026-01-18 13:12 JST pnpm --filter @hierarchidb/shape-plugin typecheck を実行（exit 0）。

2211) plan/shape/3stage-vt-pipeline-execplan (P1) — 進行中 (2026-01-16)
- ブランチ名: plan/shape/3stage-vt-pipeline-execplan
- 依存: なし
- ExecPlan: `plans/shape-3stage-vt-pipeline-execplan.md`
- 受け入れ基準: 3段階（fetch→transform→vt）の再編に向けた ExecPlan が PLANS.md 準拠で作成されている／実施項目が分割され依存関係・DoD・ロールバックが明記されている／TASKS.md の運用ログに記録されている
- 影響範囲: `plans/shape-3stage-vt-pipeline-execplan.md`, `TASKS.md`
- ロールバック手順: ExecPlan 作成差分を revert する
- チェックリスト:
  - ExecPlan を作成する
  - 実施項目を小分割して依存関係を明記する
  - 受け入れ基準とロールバックを明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 16:07 JST 3段階再編のための ExecPlan 作成に着手。
  - update: 2026-01-16 16:10 JST 実施項目の分割と ExecPlan 作成の下準備に着手。
  - update: 2026-01-16 16:15 JST ExecPlan 初版を作成（plans/shape-3stage-vt-pipeline-execplan.md）。
  - update: 2026-01-16 16:25 JST 設計方針レビューでプロパティ名とステージ表記を確定し、ExecPlan を更新。
  - update: 2026-01-16 16:35 JST ExecPlan に Milestone 詳細を追記し、Progress を更新。
  - update: 2026-01-16 17:05 JST transform-by-band/TransformByBandConfig の名称統一（transform/TransformConfig）に対応する作業に着手。
  - update: 2026-01-16 18:10 JST transform ステージ/TransformConfig への名称統一と UI/テンプレート/型の更新を実施。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-16 18:40 JST ツールバーメニューの Zoom bands 文言を新仕様に合わせて更新する作業に着手。
  - update: 2026-01-16 18:45 JST ツールバーメニューの Zoom bands 文言を Transform 設定に合わせた説明へ更新。検証: 未実施。
  - update: 2026-01-16 19:10 JST Step4 のズーム帯範囲 UI（境界スライダー/一覧表示）を追加する対応に着手。
  - blocked: 2026-01-16 19:25 JST pnpm typecheck が zoomBands.ts/TransformConfigSection 由来の型エラーで失敗。
  - update: 2026-01-16 19:35 JST ズーム帯範囲 UI と transformConfig を更新し、pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）を確認。

2212) fix/shape/geometry-simplify-invalid-polygon (P1) — 進行中 (2026-01-17)
- ブランチ名: fix/shape/geometry-simplify-invalid-polygon
- 依存: なし
- 受け入れ基準: geometrySimplify の invalid polygon エラーの原因・発生範囲・修正方法と適用範囲を説明できる／失敗時の挙動が仕様として明確（停止 or 継続）が明記されている／同じ入力で失敗しない（もしくは意図した失敗として明確なログが出る）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/*`, `packages/features/gis-sdk/src/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、geometrySimplify のエラーハンドリングを修正前に戻す
- チェックリスト:
  - invalid polygon の再現条件と発生箇所を特定する
  - エラーハンドリング方針（停止 or 継続）を明文化する
  - 修正を実装し、同一入力での挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - update: 2026-01-16 12:46 JST transform の quantize/clean/simplify の呼び出し順と後処理の確認に着手。
  - start: 2026-01-16 13:00 JST quantize の UI 設定値を transform のスナップ解像度に反映する対応に着手。
  - blocked: 2026-01-16 13:02 JST pnpm typecheck が vt-orchestrator build:types の TransformConfig.quantize 未定義で失敗。
  - update: 2026-01-16 13:02 JST pnpm --filter @hierarchidb/gis-sdk build を実行し d.ts を更新。
  - done: 2026-01-16 13:02 JST quantize のスナップ解像度反映を実装し、pnpm typecheck（exit 0）を確認。
  - start: 2026-01-16 13:09 JST transform の簡略化エラーポリゴン保存と Step5/6 表示拡張に着手。
  - update: 2026-01-17 16:20 JST 進捗表示の算出/色分けをタスク単位で再設計する調査と実装に着手。
  - start: 2026-01-17 09:00 JST geometrySimplify の invalid polygon エラー調査と修正に着手。
  - update: 2026-01-17 12:10 JST simplify 以外で投げられる invalid polygon 例外を捕捉し、詳細診断を errorMessage に含める対応に着手。
  - update: 2026-01-17 12:25 JST transform 全体を try/catch で包み、input/simplified/output の診断を errorMessage に付与。
  - update: 2026-01-17 12:35 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 12:50 JST decode/simplify/encode の失敗箇所を stage ラベルで包む診断を追加。
  - blocked: 2026-01-17 12:55 JST pnpm typecheck が vt-orchestrator の null 型エラーで失敗。
  - update: 2026-01-17 13:00 JST inputCollection の null ガードを追加し、catch 内参照を修正。
  - update: 2026-01-17 13:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 13:20 JST filter/boundary も stage ラベルで包む診断を追加。
  - blocked: 2026-01-17 13:25 JST pnpm typecheck が vt-orchestrator の括弧不足で失敗。
  - update: 2026-01-17 13:30 JST filter ラップの括弧を修正。
  - blocked: 2026-01-17 13:35 JST pnpm typecheck が workingCollection null 判定で失敗。
  - update: 2026-01-17 13:40 JST filterTarget の null ガードを追加。
  - update: 2026-01-17 13:50 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 14:05 JST counts 系の集計も stage ラベルで包む診断を追加。
  - update: 2026-01-17 14:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 14:30 JST stageLabel を追加し、未ラップ例外でも stage を付与。
  - update: 2026-01-17 14:35 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 09:35 JST quantize 後に連続同一点を統合する対応に着手。
  - update: 2026-01-17 10:10 JST quantize 後に cleanCoords を適用する対応に着手。
  - blocked: 2026-01-17 10:15 JST pnpm typecheck が @turf/clean-coords 未導入で失敗。
  - update: 2026-01-17 10:20 JST gis-sdk に @turf/clean-coords を追加。
  - blocked: 2026-01-17 10:25 JST pnpm install が pnpm store の symlink で EPERM。
  - update: 2026-01-17 10:30 JST pnpm install を再実行（昇格あり）で依存追加を反映。
  - update: 2026-01-17 10:40 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 10:50 JST cleanCoords の import を @turf/turf へ変更し Vite 解決エラーを回避。
  - blocked: 2026-01-17 10:55 JST pnpm typecheck が @turf/turf に cleanCoords が無い旨で失敗。
  - update: 2026-01-17 11:00 JST cleanCoords を @turf/clean-coords へ戻し、app に依存を追加。
  - start: 2026-01-17 16:20 JST fetch ステージが正常に動作しない問題と invalid polygon 以前の失敗要因の調査に着手。
  - update: 2026-01-17 16:27 JST startBatchProcess 開始時に pause 状態を解除し、transform の cleanCoords 例外で停止しないようガードを追加。
  - update: 2026-01-17 16:45 JST VT 生成が開始しない事象の調査と tileId リレーション欠落時のフォールバック検討に着手。
  - update: 2026-01-17 16:46 JST tileId リレーション欠落時に transformCache から再構築するフォールバックを追加。
  - update: 2026-01-17 16:47 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 16:53 JST transformCache の FlatGeobuf デコード失敗を捕捉し、失敗バッファをスキップしてログ出力するよう調整。
  - update: 2026-01-17 16:54 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:05 JST pnpm install を再実行（exit 0）。
  - update: 2026-01-17 11:10 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:20 JST transform 側に cleanCoords を追加する対応に着手。
  - update: 2026-01-17 11:25 JST transform の snap 後に cleanCoords を適用するよう更新。
  - update: 2026-01-17 11:30 JST vt-orchestrator に @turf/clean-coords を追加。
  - update: 2026-01-17 11:35 JST pnpm install を再実行（exit 0、peer 警告あり）。
  - update: 2026-01-17 11:40 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 11:50 JST transform の snap/clean 前後で booleanValid/minRingArea をログ出力する診断を追加。
  - update: 2026-01-17 11:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-17 09:45 JST pnpm typecheck が gis-sdk/geometryExtract の undefined 指摘で失敗。
  - update: 2026-01-17 09:50 JST 連続点統合のガードを修正し再実装。
  - update: 2026-01-17 09:55 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 09:05 JST invalid polygon 時は停止（継続しない）方針で合意。
  - update: 2026-01-17 09:15 JST geometry simplify 失敗時に booleanValid 判定と invalidFeatures をログへ追加。
  - update: 2026-01-17 09:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 15:10 JST quantize 後に頂点数が 2 以下になるポリゴン/穴の除去有無を確認し、未実装なら追加する対応に着手。
  - update: 2026-01-17 15:20 JST geometryExtract の quantize 後に頂点数が 2 以下のポリゴン/穴を持つポリゴンを除去する処理を追加。
  - blocked: 2026-01-17 15:30 JST pnpm typecheck が gis-sdk の geometryExtract で null 型不整合のため失敗。
  - update: 2026-01-17 15:35 JST quantizeGeometry を null 戻りとし FeatureCollection から除外するよう補正。
  - blocked: 2026-01-17 15:45 JST pnpm typecheck が vt-orchestrator の createTransformByBandHandler.ts 構文エラーで失敗。
  - update: 2026-01-17 15:55 JST createTransformByBandHandler の try/catch 構文を修正。
  - update: 2026-01-17 16:05 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:10 JST 進捗表示をポリゴン数ベースに切り替える実装に着手。
  - blocked: 2026-01-17 23:20 JST pnpm typecheck が shape-plugin の taskProgressWeights 型不整合で失敗。
  - update: 2026-01-17 23:25 JST taskProgressWeights の型を補正し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 23:30 JST 進捗表示をポリゴン数ベースで集計する変更を完了。
  - update: 2026-01-17 23:40 JST Step5 進捗バーrect幅の隙間解消対応に着手。
  - update: 2026-01-17 23:45 JST rect幅を Math.ceil+1 で補正し、pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:05 JST Step5 進捗バーrect幅の隙間解消のため Math.ceil+2 に変更する対応に着手。
  - blocked: 2026-01-18 00:10 JST pnpm typecheck が resolver-plugin の型エラーで失敗。
  - update: 2026-01-18 00:12 JST resolver-plugin の型エラー修正に着手。
  - blocked: 2026-01-18 00:20 JST pnpm typecheck が basemap-plugin の未使用変数で失敗。
  - update: 2026-01-18 00:22 JST basemap-plugin の未使用変数修正に着手。
  - blocked: 2026-01-18 00:30 JST pnpm typecheck が app のユニットテスト型エラーで失敗。
  - update: 2026-01-18 00:32 JST app テストの型エラー修正に着手。
  - update: 2026-01-18 00:40 JST basemap/resolver/app の型エラーを解消し、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-18 12:30 JST pnpm typecheck が app/src/router/routes/map/MapPage.tsx の bounds 型エラーで失敗。
  - update: 2026-01-18 12:35 JST MapPage の bounds 算出を reduce で整理し、型エラーの解消に着手。
  - update: 2026-01-18 12:40 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 12:42 JST transform エラーポリゴンの保存/Step6 エラー一覧/プレビュー表示の対応を完了。
  - start: 2026-01-18 12:50 JST transformErrors が存在する場合も Step5→Step6 遷移を有効化する対応に着手。
  - blocked: 2026-01-18 13:00 JST pnpm typecheck が shape-plugin の未使用変数（useShapeBuildStep.ts の stageKey、worker/api.ts の nodeId）で失敗。
  - update: 2026-01-18 13:15 JST 未使用変数の修正後、pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 13:20 JST transformErrors が存在する場合も Step5→Step6 遷移を有効化する対応を完了。
  - start: 2026-01-18 13:30 JST Step5 の Transform 失敗時に Step6 のエラー一覧が空になる問題の調査に着手。
  - update: 2026-01-18 13:40 JST transform エラー保存を空lineFeaturesでも記録するよう補正。
  - update: 2026-01-18 13:45 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 13:50 JST Step5 失敗時の transform エラーが Step6 の一覧に表示されるよう対応を完了。
  - start: 2026-01-18 14:00 JST ベクトルタイル未生成でもエラーLineStringをStep6地図に表示する対応に着手。
  - update: 2026-01-18 14:10 JST エラーLineStringがあればタイル無しでも地図を表示する条件に変更。
  - update: 2026-01-18 14:15 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 14:20 JST ベクトルタイル未生成でもエラーLineStringを地図表示する対応を完了。
  - start: 2026-01-18 14:30 JST Step5 Transform 進捗 SVG が灰色固定になる問題の調査に着手。
  - update: 2026-01-18 14:45 JST Transform 単独表示時は transform のタスクがあればそれを使うよう進捗バーの参照先を補正。
  - update: 2026-01-18 14:50 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - done: 2026-01-18 14:55 JST Step5 Transform 進捗 SVG が灰色固定になる問題の修正を完了。
  - start: 2026-01-18 15:05 JST Step6の地図/エラー一覧が空のままなのに遷移ボタンが有効な問題の調査に着手。
  - update: 2026-01-18 15:20 JST Transform エラー解析失敗時でもレコードを保存するよう補正。
  - update: 2026-01-18 15:25 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-18 00:42 JST Step5 rect幅を Math.ceil+2 に更新し、隙間解消対応を完了。


2210) refactor/gis-sdk/require-build-config-properties (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/gis-sdk/require-build-config-properties
- 依存: なし
- 受け入れ基準: FetchConfig/TransformByBandConfig/TransformByZoomConfig/VTConfig の各プロパティが必須化され、フォールバック/存在チェックが撤去される／ビルドステージ未使用のプロパティ一覧を特定し説明できる／Step4 UI に存在しない表示/更新項目を列挙できる／ラベル/ヘルプの不一致を列挙できる／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/config.ts`, `packages/vt-orchestrator/src/*`, `plugins/shape-plugin/src/ui/components/step4/*`, `plugins/shape-plugin/src/services/batch/session/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、型とフォールバック実装を修正前に戻す
- チェックリスト:
  - 4型のプロパティ一覧を整理して説明する
  - 4型を必須化しフォールバック/存在チェックを撤去する
  - ビルドステージ未使用のプロパティを列挙する
  - Step4 UI 未対応の表示/更新項目を列挙する
  - ラベル/ヘルプ不一致を列挙する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 14:25 JST build config の必須化と利用箇所/Step4 UI の棚卸しに着手。
  - blocked: 2026-01-16 14:45 JST pnpm typecheck が vt-orchestrator build:types の tolerance/layerSetName 型エラーで失敗。
  - update: 2026-01-16 15:30 JST pnpm --filter @hierarchidb/gis-sdk build を実行し dist 型定義を更新（exit 0）。
  - update: 2026-01-16 15:31 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 11:02 JST concurrentDownload/workers の撤去と未使用プロパティ配線・Step4 UI 修正に着手。
  - update: 2026-01-15 11:22 JST Fetch/Transform/VT の配線更新と Step4 UI 補正を反映。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 11:29 JST 並列数プロパティ名を maxConcurrent に統一する作業に着手。
  - update: 2026-01-15 11:35 JST maxConcurrent 統一方針の承認を受け、実作業に着手。
  - update: 2026-01-15 11:37 JST shape/gis-sdk/vt-orchestrator 範囲では concurrentDownloads/concurrentProcesses が残っていないことを確認。location-plugin など他領域の並列設定名は確認待ち。

2209) refactor/types/move-build-configs-to-gis-sdk (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/types/move-build-configs-to-gis-sdk
- 依存: なし
- 受け入れ基準: FetchConfig/TransformByBandConfig/TransformByZoomConfig/VTConfig/ CleanupConfig/ CommonSessionConfig が common-types から撤去され、gis-sdk 定義に統一される／参照元が common-types を使っていない／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/types/src/*`, `packages/features/gis-sdk/src/config.ts`, `plugins/shape-plugin/src/ui/components/step4/DownloadRetryControls.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、build-config 型の定義と参照を修正前に戻す
- チェックリスト:
  - common-types の build-config 型を撤去する
  - gis-sdk の型定義へ移動する
  - 参照箇所を gis-sdk 側へ更新する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 13:20 JST build-config 型の移動に着手。
  - update: 2026-01-16 13:35 JST common-types から build-config 型を削除し、gis-sdk 側へ定義を移動。参照は gis-sdk に更新。検証: 未実施。
  - update: 2026-01-16 14:10 JST pnpm typecheck を実行し成功（exit 0）。

2208) feat/shape/step3-offline-metadata-cache (P1) — 進行中 (2026-01-16)
- ブランチ名: feat/shape/step3-offline-metadata-cache
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得が 304 でローカルキャッシュを使う実装であることを確認できる／navigator.onLine === false の場合は外部アクセスを行わずローカルキャッシュを利用する／API 未到達時は外部アクセス失敗後にローカルキャッシュへフォールバックする／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `packages/features/chunk-store/src/index.ts`（確認のみ）, `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts`（確認のみ）
- ロールバック手順: 該当差分を revert し、オンライン/オフライン判定とキャッシュ利用を変更前へ戻す
- チェックリスト:
  - 304 応答時にキャッシュ利用されるコード経路を確認する
  - navigator.onLine 判定で外部アクセスを回避する処理を追加する
  - 失敗時のキャッシュフォールバック挙動を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 11:40 JST Step3 のオフライン時キャッシュ利用と 304 経路の確認に着手。
  - update: 2026-01-16 12:10 JST geoboundaries メタデータ取得で navigator.onLine===false 時はキャッシュのみ使用し、ISO3166 もオフライン時は外部CSVを参照しないよう分岐を追加。検証: 未実施。
  - update: 2026-01-16 12:40 JST Step5 fetch でオフライン時に raw data キャッシュが無ければ外部アクセスせずエラーにする分岐を追加。検証: 未実施。
  - update: 2026-01-16 12:55 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 12:25 JST pnpm typecheck を実行し成功（exit 0）。

2209) feat/ui/toolbar-zoom-bands-settings (P1) — 進行中 (2026-01-15)
- ブランチ名: feat/ui/toolbar-zoom-bands-settings
- 依存: なし
- 受け入れ基準: ツールバーの設定メニューから Zoom bands の共通設定を編集できる／変更が shape Step4 の初期値に反映される／保存先が明確で再読込できる／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/util/src/treeConsoleSettings.ts`, `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/TreeConsoleToolbarContent.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `plugins/shape-plugin/src/ui/components/step4/useShapeBuildConfigStep.ts`（調査後に確定）
- ロールバック手順: 該当差分を revert し、ツールバーからの共通設定と初期値反映を修正前に戻す
- チェックリスト:
  - Zoom bands 共通設定の保存先と読み取りを決める
  - 設定メニューに編集UIを追加する
  - shape Step4 の初期値へ設定を反映する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-01-15 21:05 JST Zoom bands の共通設定をツールバーから編集する対応に着手。
  - update: 2026-01-16 21:20 JST DoD 合意の上で実装作業を開始。
  - update: 2026-01-16 21:40 JST ツールバー設定に Zoom bands の共通設定UIを追加し、shape Step4 初期値へ反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 21:55 JST 共通ズーム帯設定が新規 Shape/Route ビルドのデフォルトに使われる旨の文言を更新。検証: 未実施。
  - update: 2026-01-16 22:10 JST DoD 合意の上で共通ズーム帯反映ボタン追加に着手。
  - update: 2026-01-16 22:25 JST Step4 に共通ズーム帯反映ボタンを追加し、押下で共通設定を適用。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 22:40 JST ズーム帯スライダーを n+1 ハンドル表示に変更し、範囲数1でも境界スライダーを表示。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 23:05 JST 共通ズーム帯スライダーを n+1 ハンドル化し、最大ズームを可変にする対応に着手。
  - update: 2026-01-16 23:35 JST 共通ズーム帯スライダーも n+1 ハンドル化し、右端を最大ズームとして可変化。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-16 23:55 JST ズーム帯の最大ズームを TransformConfig に追加し、Step4/共通設定/テンプレートへ反映。検証: pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 00:10 JST スライダーのラベル常時表示に合わせて上部パディングを追加。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - update: 2026-01-17 00:25 JST ズーム帯の境界範囲 0-11・範囲数 0-10・右端可変化と margin 32px 反映に着手。
  - blocked: 2026-01-17 00:40 JST pnpm typecheck が shape-plugin の TransformConfig に maxZoom 必須の型不整合で失敗。
  - update: 2026-01-17 00:45 JST pnpm --filter @hierarchidb/gis-sdk build（exit 0、tsdown define 警告あり）→ pnpm typecheck（exit 0）で解消。
  - update: 2026-01-17 01:10 JST ズーム帯スライダーの margin 32px の強制適用と左端固定（範囲数増殖防止）に着手。
  - update: 2026-01-17 01:20 JST スライダー margin 32px を !important で適用し、左端固定で範囲数が増えないよう補正。検証: pnpm typecheck（exit 0）。
  - update: 2026-01-17 01:30 JST ズーム帯スライダーの margin を 36px へ更新。
  - update: 2026-01-17 01:40 JST margin 36px を !important で適用。検証: pnpm typecheck（exit 0）。

2208) fix/app/tree-trash-actions (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/app/tree-trash-actions
- 依存: なし
- 受け入れ基準: パンクズの Move to Trash ダイアログで削除が成功し画面が更新される／TreeNodeInfoPanel のコンテキストメニュー「削除」で INVALID_OPERATION No items selected が発生しない／削除対象ノードが選択状態として渡される／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `app/src/hooks/treeconsole/actions/contextMenu.ts`, `packages/ui/treeconsole/breadcrumb/src/components/NodeContextMenu.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、削除操作の挙動を修正前に戻す
- チェックリスト:
  - パンクズ/コンテキストメニューの削除フローを再現する
  - 選択ノードの扱いとコマンド引数の不整合を修正する
  - UI で削除が成功しゴミ箱に移動することを確認する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ:
  - start: 2026-01-15 18:32 JST パンクズ/TreeNodeInfoPanel の削除が失敗する問題の調査に着手。
  - update: 2026-01-15 18:35 JST 削除時の選択ノードが空の場合は対象ノードを選択してゴミ箱移動に渡すよう補正。
  - update: 2026-01-15 18:35 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:05 JST パンクズ削除の confirm で対象ノードを保持し、削除後は親ノードへ遷移するよう補正。
  - update: 2026-01-15 20:05 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:13 JST パンクズの ancestor に parentId を補完し、削除後に正しく親へ遷移できるよう修正。
  - blocked: 2026-01-15 20:14 JST pnpm typecheck が app の useTreeConsoleBreadcrumbs.ts の undefined 指摘で失敗。
  - update: 2026-01-15 20:15 JST useTreeConsoleBreadcrumbs の ancestor parentId 補完で undefined ガードを追加。
  - update: 2026-01-15 20:15 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-15 20:23 JST TreeNodeInfoPanel の削除に確認ダイアログを追加し、文言を i18n へ追加。
  - update: 2026-01-15 20:24 JST pnpm typecheck を実行し成功（exit 0）。

2207) fix/ui/download-retry-controls-render-loop-v2 (P1) — 完了 (2026-01-16)
- ブランチ名: fix/ui/download-retry-controls-render-loop-v2
- 依存: なし
- 受け入れ基準: DownloadRetryControls の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/DownloadRetryControls.tsx`（調査後に確定）
- ロールバック手順: 該当差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - DownloadRetryControls のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 11:00 JST DownloadRetryControls の Maximum update depth エラー対応に着手。
  - update: 2026-01-16 11:10 JST useShapeBuildConfigStep の mergeBuildConfig が毎回 onChange を起こすため無限更新になっていたため、同値時は更新しないよう比較を追加。検証: 未実施。
  - update: 2026-01-16 11:20 JST pnpm typecheck を実行し成功（exit 0）。
  - done: 2026-01-16 11:30 JST Step4 で警告が出ないことを確認。

2206) fix/shape/step3-data-source-missing (P1) — 進行中 (2026-01-16)
- ブランチ名: fix/shape/step3-data-source-missing
- 依存: なし
- 受け入れ基準: Step3 の ShapeCountrySelection で dataSource missing が発生しない／dataSource の欠落原因が説明できる／同じ手順で再現しないことを確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step3/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step3 の dataSource 取り扱いを修正前に戻す
- チェックリスト:
  - dataSource missing の発生条件を特定する
  - Step3 の dataSource 取得/受け渡しを修正する
  - UI で再現しないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 09:30 JST Step3 の dataSource missing 調査と修正に着手。
  - update: 2026-01-16 09:40 JST Step2/Step3 で legacy dataSource を dataSourceName として解釈する対応を追加。検証: 未実施。
  - update: 2026-01-16 09:50 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 10:05 JST Step2/Step3 の legacy dataSource フォールバックを撤回し dataSourceName のみ参照に戻す。データ側の不整合は削除で対応する方針。
  - update: 2026-01-16 10:10 JST pnpm typecheck を実行し成功（exit 0）。
  - update: 2026-01-16 10:20 JST population-2023 テンプレートの buildConfig.dataSource を dataSourceName に更新。ブラウザ永続化データは削除済み。
  - update: 2026-01-16 10:30 JST pnpm typecheck を実行し成功（exit 0）。

2205) refactor/types/streamline-build-types (P1) — 進行中 (2026-01-16)
- ブランチ名: refactor/types/streamline-build-types
- 依存: なし
- 受け入れ基準: BuildConfig/TaskQueueRecord/StageHandeler の重複定義が上流（packages/common/types）に統合される／上流・下流で不一致の型は合成した新定義で整合する／下流側は上流定義を参照する／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/types/src/*`, `packages/features/gis-sdk/src/*`, `packages/vt-orchestrator/src/*`, `plugins/shape-plugin/src/*`（調査後に確定）
- ロールバック手順: 該当差分を revert し、型定義と参照を修正前に戻す
- チェックリスト:
  - BuildConfig/TaskQueueRecord/StageHandeler の重複箇所を特定する
  - 上流定義を正とし必要なら合成した型を再定義する
  - 下流側の参照を上流へ切り替える
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-16 08:55 JST BuildConfig/TaskQueueRecord/StageHandeler の重複整理に着手。
  - update: 2026-01-16 09:10 JST TransformByBandConfig/TransformByZoomConfig の統合対応を追加。
  - blocked: 2026-01-15 08:22 JST pnpm typecheck が shape-plugin の getNumCaches と TransformByBand/Zoom/VTConfig の型不整合、dataSourceName の未定義で失敗。
  - blocked: 2026-01-15 08:24 JST pnpm typecheck が shapePipeline の context 名不一致と BuildConfig の必須項目未設定で失敗。
  - blocked: 2026-01-15 08:25 JST pnpm typecheck が shapePipeline の maxBand3Reservations 未定義で失敗。
  - blocked: 2026-01-15 08:26 JST pnpm typecheck が app の buildConfig 参照不整合で失敗。
  - update: 2026-01-15 08:26 JST common-types/gis-sdk/plugin-service-api/vt-orchestrator を build し、pnpm typecheck を再実行して成功。
  - update: 2026-01-15 08:30 JST common-types へ寄せすぎ懸念のため、型の所属見直し調査に着手。
  - update: 2026-01-15 08:41 JST BuildConfig は shape-plugin のみで利用、TransformByBand/Zoom/VTConfig は vt-orchestrator と shape-plugin が利用、TaskQueueRecord/StageHandler は route/shape/vt-orchestrator が利用することを確認。
  - update: 2026-01-15 08:54 JST BaseBuildConfig/ShapeBuildConfig 分離の実装に着手。
  - start: 2026-01-15 09:00 JST TransformByBand/TransformByZoom/VTConfig とフィルタ系の定義を gis-sdk へ移動する対応に着手。
  - update: 2026-01-15 09:05 JST TransformByBand/TransformByZoom/VTConfig とフィルタ系を gis-sdk 定義へ移動し、common-types の定義と参照を整理。
  - update: 2026-01-15 09:05 JST pnpm typecheck を実行し成功（exit 0）。

2204) refactor/shape/stage-cache-naming-and-layout (P1) — 進行中 (2026-01-15)
- ブランチ名: refactor/shape/stage-cache-naming-and-layout
- 依存: なし
- ExecPlan: `plans/shape-stage-cache-naming-execplan.md`
- 受け入れ基準: ステージが fetch/transform-by-band/transform-by-zoom/vt の4段階になる／中間データはCache命名に統一される／transform-by-band/zoom の中間はephemeralのみで永続側に残らない／UI/ログ/説明がCache命名に一致する／移行/ロールバック手順がExecPlanに記載される／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/*`, `packages/vt-shape-store/src/*`, `packages/features/shape-store/src/*`, `plugins/shape-plugin/src/*` ほか（調査後に確定）
- ロールバック手順: ExecPlan に記載の手順で旧テーブル名/旧ステージ構成へ戻す
- チェックリスト:
  - ExecPlan を作成し用語/段階/データ配置を確定する
  - 中間データのCache命名をコード/DB/型に反映する
  - vt-shape-store から transform 中間成果を除去する
  - UI/ログ/説明文を新命名に合わせる
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 22:40 JST ステージ4段階化とCache命名への統一、transform中間のephemeral化に着手。
  - update: 2026-01-15 23:20 JST Buffers名称のCache化と transformByBandOutputs 廃止（ephemeralのみ）方針を反映する対応に着手。
  - update: 2026-01-15 23:50 JST EphemeralGisDB/EphemeralShapeDB のCache命名を反映し、transformBuffers 参照を削除。StageProcessingService と ShapeBuildAPIClient を更新し、headless test の fetchCache へ合わせた。ExecPlan の進捗を更新。
  - blocked: 2026-01-16 00:05 JST pnpm typecheck で shape-store build:types が fetchCache/transform-by-band の型不整合により失敗。
  - update: 2026-01-16 00:10 JST pnpm --filter @hierarchidb/gis-sdk build を実行（成功、tsdown define 警告あり）。
  - blocked: 2026-01-16 00:15 JST pnpm typecheck で runtime-worker が plugin-service-api の旧型参照（ShapeFetchCache/ShapeTransformByBandCache 未export）により失敗。
  - update: 2026-01-16 00:20 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（成功、tsdown define 警告あり）。
  - blocked: 2026-01-16 00:30 JST pnpm typecheck で route-plugin の TaskStage=transform エラーと shape-plugin の未使用変数が発生。
  - update: 2026-01-16 00:35 JST route-plugin の stage マップを transform-by-band/zoom に更新し、FetchConfigFormControls の enable 判定を整理。
  - update: 2026-01-16 00:45 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。
  - update: 2026-01-16 01:20 JST vt-shape-store から transform-by-band/zoom 中間データを排除し、ephemeral 側へ移行する対応に着手。
  - blocked: 2026-01-16 02:10 JST pnpm typecheck で vt-orchestrator build:types が @hierarchidb/shape-store 未解決と buildTransformByBandCacheRecordId 未export により失敗。
  - update: 2026-01-16 02:20 JST vt-orchestrator の transform cache id を直書きに切替え、tsconfig の paths/baseUrl を base 設定へ戻す対応を実施。
  - update: 2026-01-16 02:25 JST pnpm --filter @hierarchidb/plugin-service-api build を実行（成功、tsdown define 警告あり）。
  - update: 2026-01-16 02:40 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。

2203) fix/shape/step4-5-build-progress-ui (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step4-5-build-progress-ui
- 依存: なし
- 受け入れ基準: Step4 の削除ボタンが削除可能データの有無に応じて有効化され件数ラベルが実データと一致する／Step5 のステージ別チップは 0 件時に outlined + grey + 無反応になる／Step5 のステージ別進捗表示が固定の LinearProgress ではなくステージごとの SVG+LinearProgress 表示になる／transform invalid polygon のメッセージが extract1/2 の段階と error/total の feature/polygon 数を含む／pnpm typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`, `plugins/shape-plugin/src/ui/components/step5/*`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepPanel.tsx`, `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step4/Step5 の削除ボタン・進捗表示・transform メッセージを修正前に戻す
- チェックリスト:
  - Step4 の削除ボタン判定と件数ラベルを実データ基準に修正する
  - Step5 のステージ別チップの 0 件時表示/無効化を反映する
  - Step5 のステージ別進捗表示を SVG+LinearProgress に差し替える
  - transform の invalid polygon メッセージに段階と error/total 数を追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 20:10 JST Step4 削除ボタンの判定と Step5 進捗表示/チップ、transform エラーメッセージの改善に着手。
  - update: 2026-01-15 20:40 JST Step4 削除ボタンの件数/有効判定を実データ基準へ修正し、Step5 のステージ別チップ/進捗表示と transform エラーメッセージを更新。検証: 未実施。
  - update: 2026-01-15 20:45 JST pnpm --filter @hierarchidb/components build を実行し成功。警告: tsdown define オプションの警告あり。
  - update: 2026-01-15 20:55 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 21:10 JST Step4 Transform削除ボタンの文言/件数表記の変更に着手。
  - update: 2026-01-15 21:20 JST Transform削除ボタンの文言をズーム帯/ズーム率に変更し、件数表記にcountUnitを追加。検証: 未実施。
  - update: 2026-01-15 21:30 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 21:50 JST Transform削除ボタンの削除対象/disable条件の説明と無効化不具合の修正に着手。
  - update: 2026-01-15 22:10 JST transform削除で transformStageBuffers も削除するよう補正し、ボタンの無効化が反映されるよう修正。検証: 未実施。
  - update: 2026-01-15 22:20 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 11:41 JST Step5 ステージヘッダに maxConcurrent 分の CircularProgress を表示する対応に着手。
  - update: 2026-01-15 11:44 JST Step5 ステージヘッダに maxConcurrent の CircularProgress を追加。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:04 JST Step5 の全体進捗バー撤去に着手。
  - update: 2026-01-15 12:05 JST Step5 の全体進捗バーを撤去。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:09 JST Step5 ステージヘッダの CircularProgress と Chip 表記調整に着手。
  - update: 2026-01-15 12:10 JST Step5 ステージヘッダの停止時 CircularProgress を grey 表示にし、Failed/Completed テキストを撤去。検証: pnpm --filter @hierarchidb/components build（exit 0、tsdown define 警告あり）/ pnpm typecheck（exit 0）。
  - update: 2026-01-15 12:20 JST transform-by-band の invalid polygon 調査用に簡略化エラーの詳細サマリ出力を追加する対応に着手。
  - update: 2026-01-15 12:21 JST invalid polygon のリング/座標サマリとサンプルIDをエラーログに追加。検証: pnpm typecheck（exit 0）。
  - start: 2026-01-16 15:40 JST transform-by-band の詳細エラー情報を Step5 タスク一覧と console に表示する整備に着手。
  - update: 2026-01-16 15:50 JST Step5 タスク一覧に geometry simplify エラーの要約行を追加し、console.warn に詳細フィールドを出力。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - blocked: 2026-01-16 16:10 JST pnpm typecheck が vt-orchestrator の ring area 計算で TS18048（undefined）により失敗。
  - update: 2026-01-16 16:20 JST invalid polygon 診断に自己交差/退化リング/重複頂点/リング面積統計を追加し、transformByBand の既定 tolerance を 0.1 に調整（DEFAULT_BUILD_CONFIG と population-2023 テンプレート）。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-15 13:30 JST Step5 タスク失敗時の即停止/failed 遷移/後続タスクの skipped 扱い方針の実装に着手。
  - blocked: 2026-01-15 13:40 JST pnpm typecheck で @hierarchidb/vt-orchestrator の compareTaskOrder.ts:124 が TS2339（failureError.message が never 扱い）で失敗。
  - update: 2026-01-15 13:41 JST runStageTasks の停止/中断対応と各ステージの abortSignal 伝播を反映。検証: pnpm typecheck（exit 0、tsdown define 警告あり）。
  - start: 2026-01-15 14:00 JST 未使用プロパティ一覧の更新と有効化/統合/撤去の提案整理に着手。
  - update: 2026-01-15 14:02 JST Fetch/TransformByBand/TransformByZoom/VTConfig の未使用プロパティを棚卸しし、提案内容を整理。
  - start: 2026-01-15 16:07 JST 3段階ステージ構成（fetch → transform → vt）への再編プラン整理に着手。
  - start: 2026-01-15 16:10 JST 3段階再編の実施項目分割と ExecPlan 作成に着手。


2202) fix/components/buildstep-stage-filter-chips (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/components/buildstep-stage-filter-chips
- 依存: なし
- 受け入れ基準: BuildStepPanel の Failed/Completed チップがステージ単位でトグル動作しタスク一覧の表示を制御する／視覚的に選択状態が反映される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepPanel.tsx`
- ロールバック手順: 該当差分を revert し、チップのトグル連携を修正前に戻す
- チェックリスト:
  - Stage ごとの filter 状態を保持する
  - Failed/Completed チップのトグルが filter に反映される
  - タスク一覧が filter に応じて切り替わる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 19:10 JST BuildStepPanel の Failed/Completed チップがトグルとして機能しないため修正に着手。
  - update: 2026-01-15 19:20 JST ステージ単位の filter 状態を保持し、チップのトグルで BuildStageFilterProvider に反映。検証: 未実施。
  - update: 2026-01-15 19:35 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。

2201) fix/shape/step5-running-on-enter (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step5-running-on-enter
- 依存: なし
- 受け入れ基準: Step5 に遷移しただけでは「ビルド開始」が loading にならない／「一時停止」が enable にならない／全体進捗の LinearProgress が indeterminate で動作し続けない／通常のビルド開始フローは維持される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step5 の進捗判定を修正前に戻す
- チェックリスト:
  - Step5 進捗の running 判定条件を確認する
  - Step5 遷移直後に running 判定にならないよう補正する
  - UI で Step5 の表示を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 16:10 JST Step5 へ遷移しただけで running 判定になるため修正に着手。
  - update: 2026-01-15 16:30 JST Step5 で稼働マーカーがない場合は running/paused を解除し、初回表示でタスクを再取得するよう補正。検証: 未実施。
  - update: 2026-01-15 16:40 JST 方針誤りのため Step5 初回のタスク再取得と running/paused 判定補正を差し戻し。検証: 未実施。
  - start: 2026-01-15 17:00 JST Step5 離脱時に未完了ビルドを一時停止扱いとし、復帰時に再開できるよう修正に着手。
  - update: 2026-01-15 17:20 JST Step5 離脱/タブ閉じで processing 中のビルドを pauseBatchSession し、processingStatus を paused に更新する処理を追加。検証: 未実施。
  - blocked: 2026-01-15 17:35 JST pnpm typecheck で shape-plugin の未使用変数と BuildStatus 型エラーが発生。
  - update: 2026-01-15 17:40 JST 未使用変数削除と BuildStatus の型指定で typecheck エラーを解消。
  - update: 2026-01-15 17:45 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - update: 2026-01-15 18:10 JST Step5 の buildStatus 判定フローと paused 復帰時の running 表示原因をコード調査。
  - update: 2026-01-15 18:30 JST Step5 の running/paused 判定を processingStatus 単一ソースに統一し、タスク/進捗由来の状態推定を撤廃。検証: 未実施。
  - update: 2026-01-16 03:20 JST Step5 でビルド開始後に fetch が進捗しない/自動で paused になる事象の調査に着手。
  - update: 2026-01-16 03:40 JST Step5 の pause 処理が依存変更時の cleanup で発火していたため、unmount 時のみ発火するよう ref 管理へ変更。
  - update: 2026-01-16 03:45 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。
  - update: 2026-01-15 18:50 JST pnpm typecheck を実行し成功（exit 0）。警告: tsdown define オプションの警告が出力されたが typecheck 自体は通過。
  - start: 2026-01-16 04:10 JST Step5 の非実行ステージの indeterminate 表示とタスクリストの Skeleton フラッシュ修正に着手。
  - blocked: 2026-01-16 04:18 JST pnpm typecheck がタイムアウトで失敗（exit 124）。
  - update: 2026-01-16 04:22 JST pnpm typecheck を再実行し成功（exit 0）。警告: tsdown define オプションの警告が出力。

2201) refactor/gis-sdk/build-types-dedupe (P1) — 進行中 (2026-01-15)
- ブランチ名: refactor/gis-sdk/build-types-dedupe
- 依存: なし
- 受け入れ基準: `packages/features/gis-sdk/src/types/_BuildConfig.ts` と `packages/features/gis-sdk/src/types/types.ts` の重複型が整理される／公開 export が明確になり既存参照が壊れない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/gis-sdk/src/types/_BuildConfig.ts`, `packages/features/gis-sdk/src/types/types.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、型定義を修正前に戻す
- チェックリスト:
  - 重複している型を特定する
  - 片方へ集約し export を整理する
  - 参照箇所を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 00:20 JST gis-sdk の BuildConfig/types 重複整理に着手。
  - update: 2026-01-15 00:30 JST BuildConfig の FeatureFilter/Hyrbid 型を processing 由来に統一し、types.ts は BuildConfig を再利用。検証: 未実施。
  - update: 2026-01-15 00:35 JST types/BuildConfig 内の再エクスポートを撤去し、types.ts の再エクスポートも削除。検証: 未実施。

2200) fix/shape-store/build-session-metadata-import (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape-store/build-session-metadata-import
- 依存: なし
- 受け入れ基準: `@hierarchidb/shape-store` の `build:types` で `BuildSessionMetadata` 未解決エラーが解消される／`@hierarchidb/gis-sdk` 参照の型名が正しいものに置換される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、型名参照を修正前に戻す
- チェックリスト:
  - エラーの参照箇所と正しい型名を特定する
  - `@hierarchidb/gis-sdk` の import を修正する
  - `@hierarchidb/shape-store` の `build:types` を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 00:00 JST `@hierarchidb/shape-store` build:types で BuildSessionMetadata が未解決のため修正に着手。
  - update: 2026-01-15 00:10 JST `@hierarchidb/gis-sdk` の参照を BatchSessionMetadata に置換。検証: 未実施。

2199) fix/shape/step5-stage-task-counts (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/shape/step5-stage-task-counts
- 依存: なし
- 受け入れ基準: Step5 の各ステージカードが上部サマリと同じ総タスク数を反映する／タスク未永続化時でも No tasks yet ではなくサマリ件数が表示される／UI確認結果を記録する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、Step5 のステージ表示を修正前に戻す
- チェックリスト:
  - サマリ由来の件数をステージ表示へ反映する
  - タスク未永続化時の表示を補正する
  - UI確認結果を記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 10:05 JST Step5 のステージ件数表示がサマリと不一致のため修正に着手。
  - update: 2026-01-15 10:30 JST task.type を優先してステージ集計するよう補正。localhost:4200 の Step5 で Fetch が Completed 0/230 とタスクリストを表示することを確認。
  - update: 2026-01-15 10:45 JST Step5 でビルド開始後に Fetch が進行しない事象の原因調査を開始。
  - update: 2026-01-15 11:10 JST 休止状態の再開でパイプラインが不在の場合に既存タスクを再開するよう補正。Step5 のビルド再開後に Fetch が進行し、Completed が増加することを確認。
  - done: 2026-01-15 11:10 JST Step5 の再開操作で Fetch が進行することを確認。検証: localhost:4200 の Step5 で進行率/Completed が更新されることを確認。
  - update: 2026-01-15 11:25 JST Step5 のタスクバークリックで該当タスク位置へスクロールする対応に着手。
  - update: 2026-01-15 11:45 JST TaskProgressBar クリックでスクロール対象を共有し、仮想化リストが該当タスク位置へスクロールするよう補正。
  - done: 2026-01-15 11:45 JST Step5 の進捗バー rect クリックでタスク一覧が該当位置へスクロールすることを確認。検証: localhost:4200 の Step5 で確認。
  - update: 2026-01-15 12:10 JST 停止→再開時に running タスクを再キュー化し、必要ならパイプラインを再起動するよう補正。
  - done: 2026-01-15 12:15 JST Step5 で fetch の running が残るケースに対して再開時に再処理する挙動へ変更。検証: localhost:4200 の Step5 で確認。
  - update: 2026-01-15 12:25 JST transform ステージの failed 判定条件の調査に着手。
  - done: 2026-01-15 12:35 JST transform failed 条件と invalid polygon の発生箇所を整理し説明を作成。
  - update: 2026-01-15 12:45 JST transform failed 条件1〜4のメッセージ明示化に着手。
  - done: 2026-01-15 13:05 JST transform failed 条件ごとのメッセージを明示化（input/band/buffer/簡略化）し説明を準備。
  - update: 2026-01-15 13:30 JST Step4 削除カードのラベルに件数表示/0件時disabledを反映。簡略化設定のtoleranceを弱める方向に調整。Discard確認で閉じない問題とTaskProgressBarのa11y警告を修正。
  - update: 2026-01-15 13:45 JST simplify failed メッセージに extract1/extract2 の段階情報を付与する修正に着手。
  - update: 2026-01-15 13:45 JST リロード直後にビルド中表示になる不具合の調査に着手。
  - update: 2026-01-15 14:20 JST リロード直後にビルド中表示になる不具合の修正に着手。
  - done: 2026-01-15 14:30 JST リロード直後に進捗がない場合は running と見なさず Start を有効化する補正を追加。検証: 未実施。
  - update: 2026-01-15 14:40 JST 進捗合計が残っていても実行中タスクがない場合は running を解除する補正を追加。検証: 未実施。

2200) fix/route/buildstep-stage-icons (P1) — 進行中 (2026-01-15)
- ブランチ名: fix/route/buildstep-stage-icons
- 依存: なし
- 受け入れ基準: RouteBuildStep の STAGES が icon を持ち BuildStage 要件を満たす／route-plugin typecheck の TS2322 が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`
- ロールバック手順: icon 追加を revert し STAGES を修正前に戻す
- チェックリスト:
  - STAGES に icon を追加する
  - typecheck を確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-15 15:00 JST RouteBuildStep の STAGES に icon がなく typecheck が失敗するため修正に着手。
  - done: 2026-01-15 15:05 JST RouteBuildStep の各ステージにアイコンを追加。検証: 未実施。

2198) feat/shape/step6-preview-tabs (P1) — 進行中 (2026-01-14)
- ブランチ名: feat/shape/step6-preview-tabs
- 依存: なし
- 受け入れ基準: Step6 Preview の既存 2 タブ構成が 3 タブ（Sources/Features/Map）に再設計される／Sources は ShapeSourceMetadata、Features は ShapeFeatureMetadata の表を表示する／Map は既存表示を維持する／既存の検索/フィルタ/選択が破綻しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/*`
- ロールバック手順: 該当差分を revert し、Step6 タブ構成を変更前に戻す
- チェックリスト:
  - Step6 のタブ構成を 3 タブへ再設計する
  - Sources/Features/Map の表示を割り当てる
  - 既存の検索/フィルタ/選択を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 17:15 JST Step6 Preview のタブ再構成に着手。
  - done: 2026-01-14 17:45 JST Step6 を Sources/Features/Map の3タブ構成に再設計。検証: 未実施。
  - update: 2026-01-14 18:35 JST ShapeOriginMetadata を ShapeSourceMetadata に差し替え。検証: 未実施。

2197) fix/shape/vector-tile-metadata-api (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/vector-tile-metadata-api
- 依存: なし
- 受け入れ基準: vector tile のメタデータ取得 API に data を含めない／Row を含む命名を撤去する／既存参照が新 API に置換される／typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/ShapeQueryAPI.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `plugins/shape-plugin/src/services/tiles/VectorTileService.ts`, `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`
- ロールバック手順: 該当差分を revert し、API/型/参照を修正前に戻す
- チェックリスト:
  - vector tile のメタデータ型/API を整理する
  - 参照箇所を新 API に置換する
  - typecheck を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 16:30 JST vector tile メタデータ API の整理に着手。
  - update: 2026-01-14 17:10 JST ExecPlan を再編し命名方針（batch→build/ephemeral/vt/Source排除）を反映。
  - done: 2026-01-14 16:50 JST listVectorTileMetadata へ変更し data を除外。検証: 未実施。

2196) refactor/batch/naming-input-payload (P1) — 進行中 (2026-01-14)
- ブランチ名: refactor/batch/naming-input-payload
- 依存: なし
- 受け入れ基準: batch/builder 周辺の命名で Source→Input, Record→Payload, Row→整理 が適用される／型・API・実装が整合する／typecheck が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/*`, `packages/runtime-worker/src/services/*`, `plugins/shape-plugin/src/services/batch/*`, `plugins/shape-plugin/src/ui/components/step4/*` ほか（スコープ確定後に絞り込み）
- ロールバック手順: 該当差分を revert し、命名を修正前に戻す
- チェックリスト:
  - 対象スコープを確定する
  - 置換ルール（Source/Record/Row）を適用する
  - 参照/型/テストを更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 15:20 JST 命名リファクタのスコープ確認に着手。
  - blocked: 2026-01-14 15:20 JST 置換対象のスコープ確定待ち。
  - update: 2026-01-14 18:20 JST build/ephemeral/vt/Origin 命名のリネームを適用中。検証: 未実施。
  - update: 2026-01-14 18:35 JST ShapeOriginMetadata を ShapeSourceMetadata に再調整。検証: 未実施。
  - update: 2026-01-14 20:05 JST Step4 UI確認: 変更したタイムアウト/リトライ間隔が再表示で保持されることを確認。ただし入力値が連結された状態（例: 300000310000 / 10002000）で保存される挙動を確認。
  - blocked: 2026-01-14 18:40 JST shape-plugin typecheck で EphemeralShapeAPI/ShapeStore 参照の差分が残存。
  - update: 2026-01-14 18:50 JST PluginEphemeralDBAPI を追加し plugin-service-api/shape-store を build。Step6 の feature sort と EphemeralShapeAPI 実装を補正し、`pnpm --filter @hierarchidb/shape-plugin typecheck` が成功。

2195) fix/shape/step4-vt-counts (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-vt-counts
- 依存: なし
- 受け入れ基準: Step4 の VT 件数が vtTasks.length に基づく／削除ボタンの件数表示が実データと一致する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts`
- ロールバック手順: 該当差分を revert し、件数集計を修正前に戻す
- チェックリスト:
  - VT 件数の集計を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 15:10 JST Step4 VT 件数表示の修正に着手。
  - done: 2026-01-14 15:12 JST VT 件数を vtTasks.length で集計するよう修正。検証: 未実施。

2194) fix/ui/buildstep-header-icon (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/buildstep-header-icon
- 依存: なし
- 受け入れ基準: BuildStepStagePanel のヘッダで title 左に icon が表示される／アイコン指定ステージで表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepPanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、ヘッダ表示を修正前に戻す
- チェックリスト:
  - BuildStepStagePanel に icon props を追加する
  - BuildStepPanel から stage.icon を渡す
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 14:50 JST BuildStep ヘッダのアイコン表示修正に着手。
  - done: 2026-01-14 15:00 JST BuildStepStagePanel に icon を追加し、BuildStepPanel から渡すよう修正。検証: 未実施。

2193) fix/ui/lru-splitview2-duplicate-header (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/lru-splitview2-duplicate-header
- 依存: なし
- 受け入れ基準: Step5 の pane ヘッダ重複表示が解消される／BuildStepStagePanel のヘッダが1回だけ表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、ヘッダ表示を修正前に戻す
- チェックリスト:
  - collapsed/expanded 時の表示構成を調整する
  - ヘッダ重複を解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 14:10 JST LRUSplitView2 のヘッダ重複表示修正に着手。
  - done: 2026-01-14 14:35 JST Step5 の stage content 側ヘッダ表示を抑止して重複を解消。検証: 未実施。
  - done: 2026-01-14 14:20 JST BuildStepPanel の collapsed 時ヘッダ描画を撤去し重複を解消。検証: 未実施。

2192) fix/ui/lru-splitview2-empty-render (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/ui/lru-splitview2-empty-render
- 依存: なし
- 受け入れ基準: Step5 で LRUSplitView2 が表示される／pane が描画される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/LRUSplitView2.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、LRUSplitView2 を修正前に戻す
- チェックリスト:
  - LRUSplitView2 のレンダ条件を見直す
  - Step5 で表示確認を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 13:35 JST Step5 の LRUSplitView2 空表示を調査開始。
  - done: 2026-01-14 13:45 JST LRUSplitView2 の幅ゼロでも Allotment を描画するよう修正。検証: 未実施。
  - update: 2026-01-14 13:55 JST panes 変更時に useLRUPanes が状態を再生成するよう補正。検証: 未実施。

2191) fix/components/buildstep-typecheck (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/components/buildstep-typecheck
- 依存: なし
- 受け入れ基準: BuildStep の型エラー（TS2305/TS7031/TS2322）が解消される／`@hierarchidb/components typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、BuildStep の実装を修正前に戻す
- チェックリスト:
  - BuildStage の型定義を修正する
  - renderPane の型注釈を補う
  - BuildStepStagePanel の props を整合させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 13:05 JST BuildStep の型エラー修正に着手。
  - done: 2026-01-14 13:15 JST BuildStage 型を追加し、BuildStep の型注釈と props を整合。検証: 未実施。

2190) fix/components/buildstep-panel-export (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/components/buildstep-panel-export
- 依存: なし
- 受け入れ基準: BuildStepPanel が @hierarchidb/components から export される／app build の MISSING_EXPORT が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/index.ts`
- ロールバック手順: 該当差分を revert し、export を修正前に戻す
- チェックリスト:
  - BuildStepPanel の export を追加する
  - app build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:50 JST BuildStepPanel export 修正に着手。
  - update: 2026-01-14 13:25 JST BuildStepPanel 再exportを再追加し、BuildStage の export/import を整理。検証: 未実施。
  - done: 2026-01-14 12:55 JST BuildStep を BuildStepPanel として再export。検証: 未実施。

2189) feat/ui/lru-splitview2 (P1) — 進行中 (2026-01-14)
- ブランチ名: feat/ui/lru-splitview2
- 依存: なし
- 受け入れ基準: LRUSplitView2 が汎用 API で追加される／進捗表示テンプレが内蔵されない／BuildStepPanel が LRUSplitView2 + BuildStepStagePanel を使う構成になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/LRUSplitView2.tsx`, `packages/components/src/BuildStepPanel.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、LRUSplitView の利用に戻す
- チェックリスト:
  - LRUSplitView2 を新規追加する
  - BuildStepPanel を LRUSplitView2 + BuildStepStagePanel で構成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:20 JST LRUSplitView2 の設計・実装に着手。
  - done: 2026-01-14 12:45 JST LRUSplitView2 を追加し、BuildStep を LRUSplitView2 + BuildStepStagePanel で構成。検証: 未実施。

2188) fix/app/typecheck-shapequeryapi-import (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/typecheck-shapequeryapi-import
- 依存: なし
- 受け入れ基準: useFolderLayers の ShapeQueryAPI import 解決エラー（TS2305）が解消される／`@hierarchidb/app typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/useFolderLayers.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、import を修正前に戻す
- チェックリスト:
  - ShapeQueryAPI の import 先を修正する
  - typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 12:00 JST useFolderLayers の ShapeQueryAPI import エラー修正に着手。
  - done: 2026-01-14 12:05 JST ShapeQueryAPI の import 先を plugin-service-api に修正。検証: 未実施。

2187) fix/app/typecheck-runtime-worker-shape-imports (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/typecheck-runtime-worker-shape-imports
- 依存: なし
- 受け入れ基準: ShapeQueryService の戻り値型不整合（TS2322）が解消される／StageProcessingService の戻り値不足（TS2366）が解消される／shape-plugin index の ShapeDB import エラー（TS2339）が解消される／`@hierarchidb/app typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeQueryService.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/index.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、各ファイルを修正前に戻す
- チェックリスト:
  - ShapeQueryService の戻り型を修正する
  - StageProcessingService の return を補完する
  - shape-plugin の ShapeDB import を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 11:35 JST app typecheck の runtime-worker/shape-plugin エラー修正に着手。
  - done: 2026-01-14 11:50 JST transformSourceBuffers 参照と ShapeDB import を修正し戻り値不足を補正。検証: 未実施。
  - update: 2026-01-14 19:05 JST ProcessingStage を BuildStage に差し替え、UnifiedBatchManagerBase に getBatchSessionStatus を追加。`pnpm --filter @hierarchidb/app typecheck` が成功。検証: 実施。
  - update: 2026-01-14 19:15 JST `pnpm --filter @hierarchidb/runtime-worker typecheck` と `pnpm --filter @hierarchidb/shape-plugin build` を実施。検証: 実施。
  - update: 2026-01-14 19:25 JST `pnpm --filter @hierarchidb/app build` を実行し成功（警告: plugin registry entry path / chunk size）。検証: 実施。
  - update: 2026-01-14 20:05 JST Step6 UI確認: タブはソース/フィーチャー/地図プレビューの3つに分離され切替可能。ビルド未完了のためメタデータ未生成メッセージを確認。
  - update: 2026-01-14 20:30 JST Step6 のメタデータ空表示を安定化。Source/Feature ともに「メタデータがまだ生成されていません」表示が安定して切替時のチラつきが出ないことを確認。
  - blocked: 2026-01-14 19:40 JST UI検証のために preview/dev を起動したが、listen EPERM（0.0.0.0:4173/4200）で起動不可。手元でのUI確認が必要。

2186) fix/app/build-unresolved-shape-preview-import (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/app/build-unresolved-shape-preview-import
- 依存: なし
- 受け入れ基準: useShapePreviewStep の import 解決エラーが解消される／`@hierarchidb/app build` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、import を修正前に戻す
- チェックリスト:
  - useShapePreviewStep の import を解決する
  - app build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 11:10 JST shape preview の import 解決エラー修正に着手。
  - done: 2026-01-14 11:20 JST shape preview/step5 の ShapeBuildApiClient import を相対パスへ修正。検証: 未実施。

2185) fix/runtime-worker/tsconfig-missing-path (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/runtime-worker/tsconfig-missing-path
- 依存: なし
- 受け入れ基準: runtime-worker の tsconfig.json で JSONError（missing field `path`）が解消される／`@hierarchidb/runtime-worker build` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/tsconfig.json`
- ロールバック手順: 該当差分を revert し、tsconfig.json を修正前に戻す
- チェックリスト:
  - tsconfig.json の references/path を修正する
  - build が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:55 JST runtime-worker tsconfig.json の JSONError 修正に着手。
  - done: 2026-01-14 11:00 JST tsconfig.json の空 references を削除し JSONError を解消。検証: 未実施。

2184) fix/shape/typecheck-session-config-mappers (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/typecheck-session-config-mappers
- 依存: なし
- 受け入れ基準: shapeSessionMappers の BatchProcessConfig/BatchSessionConfig 型不整合（TS2739）が解消される／`@hierarchidb/shape-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/shapeSessionMappers.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、shapeSessionMappers の変換ロジックを修正前に戻す
- チェックリスト:
  - shapeSessionMappers の config 変換を整理する
  - typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:35 JST shapeSessionMappers の型エラー修正に着手。
  - done: 2026-01-14 10:45 JST shapeSessionMappers の config 型ガードを BatchSessionConfig に合わせて修正。検証: 未実施。

2183) fix/shape/typecheck-missing-shape-types (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/typecheck-missing-shape-types
- 依存: なし
- 受け入れ基準: ShapeEntity/SelectedArrayByCountries の export 解決エラー（TS2305）が解消される／GeoBoundariesStrategy の decodeBuffer 型不整合（TS2322）が解消される／shapePipeline/utils の型エラーが解消される／CrashInsight の型エラー（TS2345）が解消される／`@hierarchidb/shape-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/common/types/index.ts`, `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildProgressWarnings.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、shape-plugin の型定義/参照を修正前に戻す
- チェックリスト:
  - ShapeEntity/SelectedArrayByCountries の export を整理する
  - GeoBoundariesStrategy の decodeBuffer 型不整合を解消する
  - selection 型由来の TS2339/TS7006/TS2345 を解消する
  - CrashInsight の型整合を取る
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:40 JST shape-plugin の typecheck エラー修正に着手。
  - done: 2026-01-14 10:10 JST ShapeEntity/SelectedArrayByCountries の export を追加し、GeoBoundaries/CrashInsight の型不整合を修正。検証: 未実施。
  - update: 2026-01-14 10:15 JST GeoBoundaries metadata.continent の null を undefined に補正。検証: 未実施。

2182) fix/route/typecheck-missing-route-batch-session (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/route/typecheck-missing-route-batch-session
- 依存: なし
- 受け入れ基準: RouteBatchSession の import 解決エラー（TS2307）が解消される／`@hierarchidb/route-plugin typecheck` が通る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/services/RouteBatchManager.ts`, `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts`, `plugins/route-plugin/src/services/RouteBatchSession.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、RouteBatchSession の参照パスを修正前に戻す
- チェックリスト:
  - RouteBatchSession の import 解決を修正する
  - route-plugin の typecheck が通ることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:10 JST RouteBatchSession の import 解決エラー修正に着手。
  - done: 2026-01-14 09:25 JST RouteBatchSession.ts を追加し、RouteBatchSession の import 解決エラーを解消。検証: 未実施。

2181) refactor/shape/preview-step-hook (P2) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/preview-step-hook
- 依存: なし
- 受け入れ基準: ShapePreviewStep のロジックがカスタムフックに抽出される／挙動と表示が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`（予定）
- ロールバック手順: 追加フックと差分を revert し、ShapePreviewStep の直接実装へ戻す
- チェックリスト:
  - ShapePreviewStep のロジックをフックへ抽出する
  - 影響範囲を最小に保つ
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 22:59 JST ShapePreviewStep のロジック抽出に着手。
  - done: 2026-01-10 23:04 JST ShapePreviewStep の表示ロジックを useShapePreviewStepView に抽出。検証: 未実施。

2181) refactor/shape/batch-progress-summary-card-component (P2) — 進行中 (2026-01-10)
- ブランチ名: refactor/shape/batch-progress-summary-card-component
- 依存: なし
- 受け入れ基準: TaskProgressSummaryCard がコンポーネントとして切り出される／ShapeBuildProgressPanel からの利用は既存挙動と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressPanel.tsx`
- ロールバック手順: 該当差分を revert し、関数定義のまま戻す
- チェックリスト:
  - TaskProgressSummaryCard をコンポーネントとして定義する
  - ShapeBuildProgressPanel からコンポーネントとして利用する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:36 JST TaskProgressSummaryCard のコンポーネント化に着手。
  - done: 2026-01-10 20:36 JST TaskProgressSummaryCard をコンポーネントとして分離し、ShapeBuildProgressPanel から利用。検証: 未実施。
  - update: 2026-01-10 20:36 JST renderStageContent のコンポーネント化に着手。
  - done: 2026-01-10 20:36 JST ProgressStageContent コンポーネントへ切り出し、ShapeBuildProgressPanel から利用。検証: 未実施。
  - update: 2026-01-10 20:41 JST renderTaskProgressBar のコンポーネント化に着手。
  - done: 2026-01-10 20:41 JST TaskProgressBar コンポーネントへ切り出し、ShapeBuildProgressPanel から利用。検証: 未実施。

2127) fix/components/build-stage-content-filtering (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/components/build-stage-content-filtering
- 依存: なし
- 受け入れ基準: BuildStepStageDetailsPanel の文法エラーが解消される／failed/completed のフィルタは renderStageContent 側で行われる／failed/completed の ON/OFF に応じて表示内容が切り替わる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStageDetailsPanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStep.tsx`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 該当ファイルの差分を revert し、BuildStepStageDetailsPanel 側のフィルタ処理へ戻す
- チェックリスト:
  - BuildStepStageDetailsPanel の文法エラーを解消する
  - renderStageContent に failed/completed フィルタ引数を追加する
  - フィルタ挙動を renderStageContent 側へ移動する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:55 JST BuildStepStageDetailsPanel のフィルタ移設と文法修正に着手。
  - update: 2026-01-11 23:02 JST BuildStepStageDetailsPanel からフィルタ処理を撤去し、renderStageContent 側で failed/completed フィルタを適用。検証: 未実施。
  - done: 2026-01-11 23:02 JST BuildStepStageDetailsPanel の文法修正とフィルタ移設を完了。

2128) refactor/shape/build-progress-step-split (P1) — 進行中 (2026-01-11)
- ブランチ名: refactor/shape/build-progress-step-split
- 依存: なし
- 受け入れ基準: ShapeBuildStep がコンポーネント/ロジック単位で分割され行数が大幅に削減される／挙動差分がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` と新規分割ファイル
- ロールバック手順: 分割差分を revert し単一ファイル構成へ戻す
- チェックリスト:
  - UI サブコンポーネントの分割先を設計する
  - ロジックをカスタムフックへ移動する
  - 元ファイルの行数削減と動作確認を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:10 JST ShapeBuildStep の分割リファクタに着手。
  - update: 2026-01-11 23:25 JST サブコンポーネント/フックを分割し、ShapeBuildStep を薄くする構成へ移行。検証: 未実施。
  - done: 2026-01-11 23:25 JST ShapeBuildStep の分割リファクタを完了。

2129) refactor/shape/build-progress-stage-content-component (P1) — 進行中 (2026-01-11)
- ブランチ名: refactor/shape/build-progress-stage-content-component
- 依存: なし
- 受け入れ基準: ShapeBuildProgressPanel の renderStageContent を専用コンポーネントへ分割し、挙動を維持する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressPanel.tsx` と新規コンポーネント
- ロールバック手順: 分割差分を revert し renderStageContent のまま戻す
- チェックリスト:
  - renderStageContent を専用コンポーネントへ移す
  - 呼び出し側を props 経由で整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:40 JST renderStageContent のコンポーネント化に着手。
  - update: 2026-01-11 23:55 JST renderStageContent を専用コンポーネントへ移設し、Panel 側は組み立てのみへ整理。検証: 未実施。
  - done: 2026-01-11 23:55 JST renderStageContent のコンポーネント化を完了。

2130) refactor/shape/build-progress-stage-content-props (P1) — 完了 (2026-01-14)
- ブランチ名: refactor/shape/build-progress-stage-content-props
- 依存: なし
- 受け入れ基準: BuildStep への renderStageContent 渡しが廃止され、stageContents の素直な構成へ移行する／BuildStepStagePanel の filter 状態は context 経由で stage content から参照できる／ShapeBuildProgressPanel はコンポーネントを返す関数を持たず整理される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageFilterContext.tsx`, `packages/components/src/index.ts`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`
- ロールバック手順: 該当差分を revert し、renderStageContent props を利用する構成へ戻す
- チェックリスト:
  - BuildStep/BuildStepStagePanel の props とレンダリング経路を整理する
  - stage content 側で filter を context 参照に変更する
  - ShapeBuildProgressPanel の組み立てを stageContents へ統一する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:30 JST renderStageContent props の廃止と stageContents 化に着手。
  - update: 2026-01-14 10:35 JST BuildStep/BuildStepStagePanel の props を stageContents/context へ整理。検証: 未実施。
  - done: 2026-01-14 10:40 JST ShapeBuildProgressPanel の stageContents 化と StageContent の filter context 参照を完了。検証: 未実施。


2178) feat/shape/raw-buffer-pipeline (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/raw-buffer-pipeline
- 依存: なし
- ExecPlan: `plans/shape-raw-buffer-pipeline-execplan.md`
- 受け入れ基準: DownloadBuffersForNode の命名を rawDataDataSourceBuffers に統一する／データソース戦略で raw ストリームの変換パイプを差し込める（入口でハッシュ計算）／GeoBoundaries は GeoJSON→FlatGeobuf を保存する／GADM は admin0 を zip 化して保存し admin1+ は zip のまま保存する／transformSource でバッファ形式ごとの解凍/再変換を戦略側で行う／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/datasources/*`, `packages/runtime-worker/src/services/shapeChunkStore.ts`, `packages/features/download` など（調査結果に応じて）
- ロールバック手順: 該当差分と ExecPlan を revert し、旧 download/raw バッファ経路に戻す
- チェックリスト:
  - raw buffer の命名と API を整理する
  - raw 取得の変換パイプとハッシュ計算を導入する
  - GeoBoundaries と GADM の保存フォーマットを仕様に合わせる
  - transformSource の前処理を戦略側に寄せる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 22:05 JST raw バッファ命名と fetch パイプ整備に着手。
  - update: 2026-01-10 22:10 JST ExecPlan を作成（`plans/shape-raw-buffer-pipeline-execplan.md`）。
  - update: 2026-01-10 22:30 JST GADM を GeoJSON 取得へ統一し、gpkg/shp 前提コードを削除する方針で確定。
  - update: 2026-01-10 22:55 JST raw バッファ命名の更新、raw pipeline helper、GeoBoundaries/GADM の変換パイプラインを実装。
  - done: 2026-01-10 23:05 JST raw バッファ命名更新と GADM/GeoBoundaries の GeoJSON/zip 変換パイプラインを適用。検証: 未実施。

2177) fix/shape/step4-fetch-cache-count (P1) — 進行中 (2026-01-10)
- ブランチ名: fix/shape/step4-fetch-cache-count
- 依存: なし
- 受け入れ基準: Step4 の「fetchキャッシュを削除(n件)」件数が実データと一致する／算出元が明確で矛盾がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の件数算出へ戻す
- チェックリスト:
  - fetch の件数算出を実データに合わせる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:40 JST fetch キャッシュ件数表示の不整合対応に着手。

2176) fix/ui/step5-completed-chip-on-fail (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-completed-chip-on-fail
- 依存: なし
- 受け入れ基準: 失敗時でも Completed チップが表示される／失敗時の Completed チップはアウトライン表示になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneProgressSummary.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Failed と Completed の併記を許可する
  - 失敗時は Completed チップを outlined にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:20 JST 失敗時の Completed チップ表示復帰に着手。
  - done: 2026-01-10 21:23 JST 失敗時も Completed チップを表示し、outline 表示に調整。検証: 未実施。

2175) fix/log/shape-tasksummary-spam (P1) — 完了 (2026-01-10)
- ブランチ名: fix/log/shape-tasksummary-spam
- 依存: なし
- 受け入れ基準: taskSummary の同一内容ログが連続出力されない／進捗計算や UI 表示に影響がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のログ出力へ戻す
- チェックリスト:
  - taskSummary のログを差分時のみ出力する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:05 JST taskSummary ログの連続出力抑止に着手。
  - done: 2026-01-10 21:08 JST taskSummary を差分時のみログ出力するよう抑制。検証: 未実施。

2174) fix/shape/transform-error-message-compact (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/transform-error-message-compact
- 依存: なし
- 受け入れ基準: transform の失敗メッセージが features/polygons/missingGeometry のみになる／余分な識別子が出ない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のメッセージへ戻す
- チェックリスト:
  - 失敗メッセージから band/admin/source を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:55 JST transform 失敗メッセージの簡略化に着手。
  - done: 2026-01-10 20:58 JST 失敗メッセージを features/polygons/missingGeometry のみに簡略化。検証: 未実施。

2173) fix/ui/step5-pane-failed-chip-dup (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-pane-failed-chip-dup
- 依存: なし
- 受け入れ基準: 失敗時の Chip が「Failed x」だけ表示され、重複表示が消える／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneHeader.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Failed チップの重複表示を抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:40 JST Failed チップ重複表示の対応に着手。
  - done: 2026-01-10 20:45 JST 失敗時は Failed チップのみ表示し、Completed チップを抑止。検証: 未実施。

2172) fix/ui/step5-pane-chip-labels (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/step5-pane-chip-labels
- 依存: なし
- 受け入れ基準: 上部のステージ別 Chip が「Completed n/m」形式になる／失敗がある場合は「Failed x」「Completed y/z」が表示される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/lru-splitview/src/components/PaneProgressSummary.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Completed/Failed 表記を適用する
  - 失敗がある場合は2つの Chip を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:25 JST ステージ別 Chip 表記の改善に着手。
  - done: 2026-01-10 20:30 JST Completed/Failed の Chip 表記へ変更し、失敗時は2つの Chip を表示。検証: 未実施。

2171) fix/shape/step5-pane-failed-counts (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-pane-failed-counts
- 依存: なし
- 受け入れ基準: ペインヘッダの failed 数が実際の失敗件数と一致する／タスクリストの status が実態と一致する／全体進捗の failed 数とペインヘッダが整合する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の集計ロジックへ戻す
- チェックリスト:
  - taskSummary の stage 集計が taskType ベースで行われる
  - ペイン summary の failed 件数が一致する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:10 JST Step5 failed 件数の不整合対応に着手。
  - done: 2026-01-10 20:15 JST taskType 優先でステージ集計するよう補正し、ペインの failed 数が実数を反映。検証: 未実施。

2170) fix/shape/step5-error-visibility-and-vt-status (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-error-visibility-and-vt-status
- 依存: なし
- 受け入れ基準: 失敗タスクの message が詳細な原因を含む／失敗タスクのタイトルに国名が表示される／ペインヘッダに失敗数が明示され、不要な PlayCircle が表示されない／vt ステージ 0/0 の場合に全体進捗が Ready にならない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, `packages/ui/lru-splitview/src/components/PaneHeader.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示/進捗判定へ戻す
- チェックリスト:
  - transform の失敗メッセージに feature 数/簡易化結果を含める
  - transform タスクに国名を付与する
  - PaneHeader に失敗数を表示し、0/0 で PlayCircle を出さない
  - vt 0/0 時の全体進捗/Ready 表示を抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:10 JST Step5 の失敗情報とペイン表示の不整合対応に着手。
  - done: 2026-01-10 19:40 JST 変換失敗の詳細メッセージと国名付与、ペインヘッダの失敗数表示と0/0時のアイコン抑制、vt 0/0時のReady表示補正を実施。検証: 未実施。

2169) fix/shape/step4-5-task-labels-and-delete (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-5-task-labels-and-delete
- 依存: なし
- 受け入れ基準: Step5 の transform タスクに国情報が表示される／成功・失敗メッセージが表示される／Step4 の Transform キャッシュ削除ボタンが対象タスクありで有効化される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の表示/削除判定へ戻す
- チェックリスト:
  - transform タスクタイトルに国コード/国名を含める
  - タスクの message/errorMessage を UI へ表示する
  - vt-task-queue のタスク数で削除ボタンが有効になる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:20 JST Step5 タスク表示と Step4 削除ボタンの不整合対応に着手。
  - done: 2026-01-10 18:45 JST transform タスクの国表示とエラーメッセージ表示を追加し、vt-task-queue の件数で削除ボタンを有効化。検証: 未実施。

2168) fix/dialog/conflict-autosave-policy (P1) — 完了 (2026-01-10)
- ブランチ名: fix/dialog/conflict-autosave-policy
- 依存: なし
- 受け入れ基準: 競合チェックが保存時のみ実行される／autosave は実編集後にのみ実行される／UI state 保存による version 変化は競合判定に含まれない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`, `packages/plugin-ui-host/src/headless/usePluginDialogController/conflict-guard.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/autosave.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の競合チェック/ autosave の挙動へ戻す
- チェックリスト:
  - ステップ遷移で競合チェックを実行しない
  - autosave を実編集後にのみ許可する
  - UI state 変更のみの version 変化を競合扱いしない
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:30 JST 競合チェックと autosave の方針修正に着手。
  - done: 2026-01-10 18:05 JST 競合チェックを保存時のみ実行し、autosave は実編集後に限定、UI state のみの更新は競合扱いしないよう補正。検証: 未実施。

2167) fix/shape/step4-stepper-stall (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-stepper-stall
- 依存: なし
- 受け入れ基準: Step4「処理設定」への遷移で CircularProgress が無限に残らず操作可能になる／無限ローディングの原因を特定し修正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/conflict-guard.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step4 遷移挙動へ戻す
- チェックリスト:
  - ステップ遷移時の pendingAction が解放されることを確認する
  - 影響範囲を最小にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:05 JST Step4 遷移で Stepper の CircularProgress が固まる問題の調査に着手。
  - done: 2026-01-10 17:12 JST ステップ遷移時の競合チェックが応答待ちで固まるケースにタイムアウトを追加し、pendingAction が解放されるよう補正。検証: 未実施。

2166) fix/shape-route/step5-tasklist-vt-queue (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape-route/step5-tasklist-vt-queue
- 依存: なし
- 受け入れ基準: Step5 のタスク一覧が vt-task-queue を唯一の参照元として表示される／旧 getBatchTaskSummaries（ephemeral）を参照しない／shape・route の双方で「no tasks yet」が解消され完了タスクが一覧に表示される／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/worker/*`, `plugins/route-plugin/src/worker/*`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のタスク一覧取得ロジックへ戻す
- チェックリスト:
  - vt-task-queue を唯一のタスク取得元に統一する
  - shape/route の Step5 でタスク一覧が表示されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 16:05 JST Step5 のタスク一覧が vt-task-queue を参照しない問題の修正に着手。
  - done: 2026-01-10 16:35 JST getBatchTaskSummaries を撤去し vt-task-queue のみからタスク一覧を取得するよう統一。route 側も vt-task-queue 連携を追加。検証: 未実施。

2165) fix/shape/step5-progress-phase-stability (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-phase-stability
- 依存: なし
- 受け入れ基準: Step5 のビルド中に Start/Pause の表示が安定し、頻繁な切替が起きない／fetch の進捗が表示され Skeleton の明滅が収まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の進捗イベント運用へ戻す
- チェックリスト:
  - 進捗イベントの phase をセッション状態に合わせて安定させる
  - UI のビルド状態がタスク完了イベントで完了へ切り替わらないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:41 JST Step5 の進捗 phase が不安定でボタン状態が揺れる問題の対応に着手。
  - done: 2026-01-10 15:43 JST taskQueue 進捗イベントの phase をセッション状態へ統一し、完了/一時停止で揺れないよう補正。検証: 未実施。

2164) fix/ui/batch-progress-debounce (P1) — 完了 (2026-01-10)
- ブランチ名: fix/ui/batch-progress-debounce
- 依存: なし
- 受け入れ基準: batch progress の UI 更新が適度にバウンスされ、Maximum update depth 警告が発生しない／更新頻度が抑制されても最終状態が反映される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/batch/src/progress/useBatchProgress.ts`（必要に応じて）
- ロールバック手順: 該当差分を revert し、従来の即時更新へ戻す
- チェックリスト:
  - progress 反映をデバウンスし、UI 更新頻度を抑制する
  - 最終状態が反映されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:38 JST progress 更新のバウンス対応に着手。
  - done: 2026-01-10 15:39 JST useBatchProgress の更新を 100ms デバウンスし、連続通知を抑制。検証: 未実施。

2163) fix/shape/step5-build-progress-and-pause (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-build-progress-and-pause
- 依存: なし
- 受け入れ基準: Step5 のビルド中に「停止」ボタンが有効化される／BuildStep に進捗が反映され Skeleton のみにならない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `packages/components/src/BuildStep.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step5 表示/操作へ戻す
- チェックリスト:
  - 停止ボタンの有効条件と i18n 表示を確認する
  - ビルド進捗の反映経路を整理し UI へ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:17 JST Step5 の停止ボタン未有効化と進捗未反映の調査に着手。
  - done: 2026-01-10 15:32 JST pause/resume の実装と Step5 の進捗ポーリング補正、Pause ラベルの i18n 反映を実施。検証: 未実施。

2162) fix/shape/step4-delete-cache-disabled (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step4-delete-cache-disabled
- 依存: なし
- 受け入れ基準: Step4 の「fetchキャッシュを削除(n件)」ボタンが件数>0で有効化される／クリックで削除が実行され件数表示が更新される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`, `plugins/shape-plugin/src/ui/components/steps/DownloadConfigSection.tsx`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のボタン状態へ戻す
- チェックリスト:
  - ボタンの disabled 条件が件数>0の時に有効化されるよう整理する
  - クリック時の削除処理と件数更新を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:05 JST Step4 の fetch キャッシュ削除ボタンが無効な問題の調査に着手。
  - done: 2026-01-10 15:08 JST Step4 の削除ボタン有効/無効判定を実際の batch session 状態で評価するよう補正。検証: 未実施。

2161) fix/shape/step5-fetch-progress-live (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-fetch-progress-live
- 依存: なし
- 受け入れ基準: Step5 の fetch 進捗がリアルタイムで反映される／進捗イベントの送信元とUI側の購読・集計が一致していることを確認する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `packages/features/batch/src/session/AbstractBatchSession.ts`, `plugins/shape-plugin/src/worker/api.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の進捗表示仕様へ戻す
- チェックリスト:
  - fetch の進捗イベントが UI に届いているか確認する
  - 集計/表示が進捗イベントのステージ名と一致するよう補正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:00 JST Step5 の fetch 進捗がリアルタイムに反映されない問題の調査に着手。
  - done: 2026-01-10 15:03 JST 進捗イベントにタスク集計ペイロードを付与し、Step5 の進捗集計が更新されるように修正。検証: 未実施。

2160) fix/shape/step5-progress-stage-naming (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-stage-naming
- 依存: なし
- 受け入れ基準: Step5 の進捗表示で誤ったステージ名を許容せず、正しいステージ名のみが扱われる／誤ったステージ名の発生源が修正される（コード内に残らない）／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/utils/buildWarnings.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来のステージ名許容へ戻す
- チェックリスト:
  - 誤ったステージ名の発生源を特定し、正しい命名へ修正する
  - UI 側の誤名称フォールバックを撤去する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:58 JST Step5 進捗ステージ名の誤表記対応に着手。
  - done: 2026-01-10 14:59 JST コード内の `fetch-shape` 発生源を確認したが該当なしのため、UI側の誤名称フォールバックを撤去。検証: 未実施。

2159) fix/shape/step5-progress-ui-stability (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step5-progress-ui-stability
- 依存: なし
- 受け入れ基準: shape Step5 で LinearProgress の表示有無によるレイアウトの縦揺れが発生しない／fetch-shape ステージの進捗が Step5 の画面に反映される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、従来の Step5 進捗表示へ戻す
- チェックリスト:
  - LinearProgress の表示有無でレイアウトが跳ねないようスペースを確保する
  - fetch-shape ステージの進捗状態を Step5 画面に反映させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:44 JST shape Step5 の進捗表示ゆれと fetch-shape 反映漏れの修正に着手。
  - done: 2026-01-10 14:46 JST fetch-shape を進捗集計へ正規化し、Step5 の進捗バーを常時高さ固定にして縦揺れを解消。検証: 未実施。

2158) fix/ui-map/add-deckgl-core-deps (P1) — 完了 (2026-01-12)
- ブランチ名: fix/ui-map/add-deckgl-core-deps
- 依存: なし
- 受け入れ基準: `@hierarchidb/ui-map` の devDependencies/peerDependencies に `@deck.gl/core` を追加する／`app` の dependencies に `@deck.gl/core` を追加する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/package.json`, `app/package.json`
- ロールバック手順: 該当 package.json の差分を revert する
- チェックリスト:
  - ui-map の peer/dev に @deck.gl/core を追加する
  - app の dependencies に @deck.gl/core を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 00:50 JST deck.gl core 依存の追加対応に着手。
  - done: 2026-01-12 00:55 JST ui-map の peer/dev と app dependencies に @deck.gl/core を追加。検証: 未実施。

2157) refactor/ci/turbo-preflight-parallel (P1) — 完了 (2026-01-11)
- ブランチ名: refactor/ci/turbo-preflight-parallel
- 依存: なし
- 受け入れ基準: `guard:preflight` の直列実行を turbo タスクで並列化する／`pnpm typecheck` の実行内容を維持する／依存関係が必要なもののみ順序付けする／TASKS.md に運用ログを記載する
- 影響範囲: `package.json`, `turbo.json`, `scripts/**`（必要時）
- ロールバック手順: 該当差分を revert して直列実行へ戻す
- チェックリスト:
  - guard:preflight の各チェックを turbo タスク化する
  - 依存関係があるものだけ dependsOn で明示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 23:20 JST guard:preflight の並列化設計に着手。
  - done: 2026-01-11 23:35 JST turbo の preflight タスクに分割し、guard:preflight を turbo 実行へ移行。検証: 未実施。
  - update: 2026-01-11 23:45 JST package.json の JSON 構文エラーを修正し、preflight スクリプトを scripts に配置し直した。検証: `node -e "JSON.parse(...)"`（成功）。

2156) fix/types/any-replacement (P1) — 完了 (2026-01-11)
- ブランチ名: fix/types/any-replacement
- 依存: なし
- 受け入れ基準: 指定された `any` 使用箇所を厳密な型に置換する／必要な型定義を追加する／`any` を残さない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/testing/plugin-dialog-mocks/src/mocks/WorkerAPIImpl.ts`, `packages/tools/gen-iso3166-2/src/scraper.ts`, `packages/ui/map/src/components/MapWithVectorTiles.tsx`, `packages/ui/map/src/components/MapWithDeckGL.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `packages/plugin-ui-host/src/PluginDialogHost.tsx`
- ロールバック手順: 該当ファイルの差分を revert して `any` 利用に戻す
- チェックリスト:
  - 指定ファイルの `any` 使用箇所を特定する
  - 既存型または新規型定義で置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:40 JST any 使用箇所の型厳格化に着手。
  - done: 2026-01-11 23:05 JST 指定ファイルの any を厳密な型へ置換し、入力検証/型定義を追加。検証: 未実施。
  - update: 2026-01-11 23:55 JST gen-iso3166-2 の型チェックエラーに対応し、cheerio 型の参照を domhandler 直接依存から外した。
  - update: 2026-01-12 00:05 JST cheerio の型推論が never になるため、最小限の CheerioCollection 型と型ガードで処理を明示した。
  - update: 2026-01-12 00:20 JST gen-iso3166-2 に domhandler を明示依存として追加し、cheerio 由来の AnyNode 型で型を整理した。
  - update: 2026-01-12 00:30 JST domhandler 直接参照を撤回し、CheerioAPI の入力型へ明示キャストする helper で型安全に統一した。
  - update: 2026-01-12 00:40 JST Cheerio<AnyNode> の this コンテキスト不整合を解消するため domhandler 依存を復帰し、selectNode の戻り型を AnyNode に揃えた。

2155) chore/ui-plugin-shell/remove-pretypecheck (P1) — 完了 (2026-01-10)
- ブランチ名: chore/ui-plugin-shell/remove-pretypecheck
- 依存: なし
- 受け入れ基準: `packages/ui/plugin-shell` の pretypecheck を削除する／`scripts/pretypecheck-ui-shell.mjs` を削除する／turbo の依存関係を必要最小限で補正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/plugin-shell/package.json`, `scripts/pretypecheck-ui-shell.mjs`, `turbo.json`（必要時）
- ロールバック手順: 該当差分を revert し、pretypecheck を復元する
- チェックリスト:
  - pretypecheck の削除と不要ファイルの撤去
  - turbo 依存関係の補正
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-10 12:34 JST pretypecheck の削除と turbo 依存関係の補正に着手。
  - done: 2026-01-10 12:38 JST pretypecheck を削除し、ui-plugin-shell の typecheck 依存を turbo に移行。

2154) chore/analysis/turbo-cache-miss (P1) — 完了 (2026-01-10)
- ブランチ名: chore/analysis/turbo-cache-miss
- 依存: なし
- 受け入れ基準: `pnpm build`/`pnpm typecheck` の turbo キャッシュ無効化要因を特定し、根拠（設定/ログ/入力差分）を示す／改善策を即時対応と構造改善に分けて整理する／TASKS.md に運用ログを記載する
- 影響範囲: `turbo.json`, `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `packages/**/package.json`（調査に応じて）
- ロールバック手順: 調査のみのためロールバック不要（変更が入った場合は該当差分を revert）
- チェックリスト:
  - turbo の cache miss 要因（inputs/outputs/env/pipeline）を特定する
  - build/typecheck の実行条件と差分発生源を整理する
  - 改善策と副作用を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 12:25 JST turbo キャッシュ無効化の原因調査に着手。
  - update: 2026-01-10 12:45 JST `app/package.json` の build が `tools:gen-plugin-registry` と複数 `pnpm --filter ... build` を内包し、turbo の外で再ビルドが走る構成を確認。`packages/ui/plugin-shell/package.json` の pretypecheck が `scripts/pretypecheck-ui-shell.mjs` 経由で依存パッケージ build を直叩きするため、dist 不在時に typecheck が広範に再ビルドする経路を確認。ワークツリーの変更が多数あるため当該パッケージの cache miss が発生しやすい状態であることを確認。
  - done: 2026-01-10 12:50 JST turbo キャッシュ無効化の要因と改善案を整理。

2125) fix/auth/cancel-cooldown-prevent-reopen (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/auth/cancel-cooldown-prevent-reopen
- 依存: なし
- 受け入れ基準: Cancel 押下後に auth-required ダイアログが即再表示されない／Cancel 後はクールダウン中に AUTH_REQUIRED を再発行しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当ファイルの差分を revert し、Cancel 後も即再表示する挙動へ戻す
- チェックリスト:
  - Cancel 後の再表示発生経路を確認する
  - クールダウン中は AUTH_REQUIRED を dispatch しないよう抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:20 JST Cancel 後に auth-required が再表示される問題の修正に着手。
  - update: 2026-01-11 22:23 JST awaitAuth の開始時にクールダウン判定を追加し、Cancel 後は AUTH_REQUIRED を再発行しないよう抑止。検証: 未実施。
  - done: 2026-01-11 22:23 JST Cancel 後の auth-required 再表示抑止を完了。

2126) fix/shape/retry-fetch-tasks-on-restart (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/retry-fetch-tasks-on-restart
- 依存: なし
- 受け入れ基準: fetch ステージで HTTP 502 失敗したタスクが「ビルド開始」押下時の再開で再実行される／ダウンロードが再試行される／既存の pause/resume 挙動を壊さない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/stage/useBatchSessionActions.ts`
- ロールバック手順: 該当ファイルの差分を revert し、再開時に再実行しない挙動へ戻す
- チェックリスト:
  - 失敗した fetch タスク検知を追加する
  - 再開時に強制的に startBatchSession を選択する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:40 JST fetch 失敗タスクの再実行対応に着手。
  - update: 2026-01-11 22:44 JST fetch 失敗タスクがある場合は再開時に startBatchSession を強制し再実行させるよう調整。検証: 未実施。
  - done: 2026-01-11 22:44 JST fetch 失敗タスクの再実行対応を完了。

2130) docs/location-plugin-design (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` を新規作成し、Step2-6 の UI/処理フロー、データソース/範囲/ビルド設定/ビルド/プレビューの方針、MapLibreGL 表示 + Dexie.js + モートン順序共通接頭辞検索による LocationQueryAPI 設計、vt 系ドキュメントとの差分を明記し、確認事項を列挙する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメントと本項目の差分を revert する
- チェックリスト:
  - location-plugin 設計ドキュメントの章立てを作成する
  - Step2-6 の UI/処理フローと API/データモデル方針を記述する
  - vt 系ドキュメントとの差分と未決事項を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:01 JST location-plugin 設計ドキュメント作成に着手。
  - done: 2026-01-09 08:03 JST `docs/location-plugin-design.md` を作成し、Step2-6 と非VT方針・LocationQueryAPI 設計・ui-map 方針を整理。

2131) docs/location-plugin-design-prefetch-margin (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-prefetch-margin
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に表示範囲のマージン指定（prefetch）を追加し、LocationQueryAPI のマージン指定パラメータ、ui-map 側の bbox 拡張フロー、既定値/上限を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - マージン指定の用語と単位を定義する
  - LocationQueryAPI にマージン指定を追記する
  - ui-map 側の bbox 拡張フローと既定値/上限を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:07 JST location-plugin の prefetch マージン仕様追記に着手。
  - done: 2026-01-09 08:07 JST prefetch マージンの指定方法と既定/上限値、検索フローと ui-map の呼び出し手順を追記。

2132) docs/location-plugin-design-details (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-details
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に CSV 列定義（必須/任意/型変換）を現行実装から抽出して明記し、LocationType の表示名対応、ズーム上限 11、アイコン/円のスタイル方針（既存アイコン利用、仮色、サイズ計算プロパティ化/既定線形）を追記し、LocationDB.vectorTiles の停止/削除方針を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - CSV 列定義と型変換ルールを整理する
  - LocationType の表示名対応を明記する
  - ズーム上限とスタイル方針を追記する
  - vectorTiles 停止/削除方針を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 08:15 JST location-plugin 設計詳細の反映に着手。
  - done: 2026-01-09 08:16 JST CSV列定義/LocationType表示名/ズーム上限/スタイル方針/vectorTiles停止の仕様を追記。

2133) docs/location-plugin-design-csv-missing-cases (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-csv-missing-cases
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に CSV の不足ケース（必須列欠落・数値変換失敗・ヘッダ不一致・国情報欠落）の扱いを明記し、確認事項を解消済みに更新する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - CSV の不足ケース運用を明記する
  - 確認事項の該当項目を解消済みに更新する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 08:34 JST CSV 不足ケース仕様の追記に着手。
  - done: 2026-01-09 08:34 JST CSV 不足ケースの扱いと確認事項の解消を追記。

2134) docs/location-plugin-design-style-defaults (P1) — 完了 (2026-01-09)
- ブランチ名: docs/location-plugin-design-style-defaults
- 依存: なし
- 受け入れ基準: `docs/location-plugin-design.md` に仮色の具体値（circle/icon）、サイズ計算式の既定値（線形）と `sizeFn` の入力/出力仕様、ui-map レイヤへの適用方法を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/location-plugin-design.md`
- ロールバック手順: 追加したドキュメント差分と本項目の差分を revert する
- チェックリスト:
  - 仮色の具体値を決めて追記する
  - 既定サイズ計算式と `sizeFn` 仕様を追記する
  - ui-map の circle/icon への適用方法を明記する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 08:35 JST location-plugin のスタイル既定値追記に着手。
  - done: 2026-01-09 08:36 JST 仮色/sizeFn 既定式と ui-map 適用方法を追記。

2135) plans/location-plugin-repair-execplan (P1) — 完了 (2026-01-09)
- ブランチ名: plans/location-plugin-repair-execplan
- 依存: なし
- ExecPlan: `plans/location-plugin-repair-execplan.md`
- 受け入れ基準: location-plugin 修復の ExecPlan を作成し、Step2〜Step6 と LocationQuery/Mutation/ui-map 連携の実装方針、検証、ロールバックを自己完結で記述する／TASKS.md に運用ログを記載する
- 影響範囲: `plans/location-plugin-repair-execplan.md`
- ロールバック手順: 追加した ExecPlan と本項目の差分を revert する
- チェックリスト:
  - ExecPlan を作成して自己完結の仕様と手順を記載する
  - 実装フェーズと検証/ロールバックを具体化する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-09 09:32 JST location-plugin 修復 ExecPlan 作成に着手。
  - done: 2026-01-09 09:49 JST ExecPlan を作成し、修復マイルストーンと検証/ロールバックを整理。

2136) feat/location/non-vt-viewport-query (P1) — 進行中 (2026-01-09)
- ブランチ名: feat/location/non-vt-viewport-query
- 依存: なし
- ExecPlan: `plans/location-plugin-repair-execplan.md`
- 受け入れ基準: location-plugin の Step2-6 が CSV ソースのビルドと非VTの MapLibre プレビューに対応し、LocationQueryAPI が viewport 検索と prefetch マージン指定を受けられる／vectorTiles を参照せず points を描画できる／地物種類トグル・前方一致検索・ホバー/選択（半径8px）の強調表示が非VTでも動作する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/LocationQueryAPI.ts`, `packages/plugin-service-api/src/types/LocationMutationAPI.ts`, `packages/runtime-worker/src/services/LocationQueryService.ts`, `packages/runtime-worker/src/services/LocationMutationService.ts`, `packages/features/location-store/src/EphemeralLocationDB.ts`, `plugins/location-plugin/src/worker/**`, `plugins/location-plugin/src/ui/components/**`, `docs/location-plugin-design.md`（参照整合が必要な場合）
- ロールバック手順: 上記差分を revert し、vectorTiles ベースの LocationQueryService と UI の既存プレビューへ戻す
- チェックリスト:
  - LocationQuery/Mutation API と worker 実装を非VT検索へ移行する
  - LocationDB と worker store のインデックスを更新する
  - Step2-6 UI を CSV + viewport クエリに合わせる
  - トグル/検索/ホバー/選択の UI を非VT検索に接続する
  - 検証と運用ログを追記する
- 運用ログ：
  - start: 2026-01-09 09:53 JST location 非VT viewport 検索への移行に着手。
  - update: 2026-01-09 10:19 JST LocationQueryAPI に viewport 検索型を追加し、LocationQueryService を非VT検索へ置換。LocationDB に mortonKey/kind インデックスを追加し、プレビューは viewport クエリで GeoJSON 描画へ切替。vectorTiles 参照は UI/worker から除去中。
  - update: 2026-01-13 09:10 JST 地物種類トグル/前方一致検索/ホバー選択(8px)を非VT検索で再現する方針で進行する。
  - update: 2026-01-13 10:15 JST map ページで location ノードを非VT検索で描画するため、location レイヤ情報/GeoJSON レイヤを追加し、viewport クエリ/hover+selection(8px)を接続。MapLibre での hover/selection を距離順に整列。LocationMapPreviewStep のテストを新仕様へ更新。
  - update: 2026-01-13 11:05 JST map/LocationMapPreview のアイコン表示を追加し、MUI アイコンから SVG を生成して MapLibre に登録。GeoJSON 複数レイヤ共有ソースの扱いを ResourceLayerMap で改善。
  - blocked: 2026-01-13 11:20 JST `pnpm typecheck` が guard:deps:extra で失敗。tsconfig.base.json の vt-* パスが src 指向のためポリシー違反（@hierarchidb/vt-store / vt-shape-store / vt-orchestrator）。対応方針の指示待ち。
  - update: 2026-01-13 11:25 JST tsconfig.base.json の vt-* paths を dist 指向へ修正し、guard:deps:extra 違反の解消を実施。
  - update: 2026-01-13 11:35 JST `pnpm typecheck` は runtime-worker の型エラーで失敗（LocationQueryService の型キャスト/ShapeMutationService のステージ不足）。修正後 `pnpm --filter @hierarchidb/runtime-worker typecheck` を再実行し成功。
  - update: 2026-01-13 11:45 JST LocationMapPreviewStep の typecheck エラーを修正し、`pnpm --filter @hierarchidb/location-plugin typecheck` を再実行して成功。
  - blocked: 2026-01-13 11:55 JST `pnpm typecheck` は shape-plugin の既存型エラーで失敗（vt-* モジュール解決と BatchTaskType/StageStatus 不整合、暗黙 any など）。対応方針の指示待ち。
  - update: 2026-01-13 12:10 JST shape-plugin の型エラー解消に向けて ShapeBatchTaskStage を fetch/transform/vt へ拡張し、shapeSessionMappers のステージ変換/集計を補正。vt-* の paths を src 指向へ戻し、`pnpm --filter @hierarchidb/plugin-service-api build` を実行後、`pnpm --filter @hierarchidb/shape-plugin typecheck` が成功。

2137) fix/workspace/include-vt-packages (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/workspace/include-vt-packages
- 依存: なし
- 受け入れ基準: `pnpm i` が `@hierarchidb/vt-orchestrator` の未解決で失敗しない／workspace 設定の変更は最小限／TASKS.md に運用ログを記載する
- 影響範囲: `pnpm-workspace.yaml`
- ロールバック手順: workspace 追加行を削除して revert する
- チェックリスト:
  - workspace に vt-* パッケージを含める
  - `pnpm i` で未解決エラーが再現しないことを確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-13 12:25 JST vt-* パッケージが workspace に含まれず pnpm i が失敗する問題の修正に着手。
  - update: 2026-01-13 12:27 JST `pnpm i` が EPERM（pnpm store への symlink 作成）で失敗。sandbox 権限の影響と判断。
  - done: 2026-01-13 12:28 JST `pnpm i` を権限昇格で再実行し成功。workspace への vt-* 追加を反映。
  - update: 2026-01-13 12:40 JST tsconfig.base.json の vt-* paths を dist 指向へ復帰し、`pnpm --filter @hierarchidb/vt-store build` / `pnpm --filter @hierarchidb/vt-shape-store build` / `pnpm --filter @hierarchidb/vt-orchestrator build` を実行して d.ts を生成。
  - update: 2026-01-13 13:05 JST vt-orchestrator の build:types 失敗に対応し、geojson 型導入と chunk-store 参照を調整。`pnpm i`（権限昇格）、`pnpm --filter @hierarchidb/chunk-store build`、`pnpm --filter @hierarchidb/vt-orchestrator build:types` を実行して成功。
  - update: 2026-01-13 13:20 JST app build の vt-store 未解決に対応し、`app/package.json` に `@hierarchidb/vt-store` を追加。`pnpm i` を権限昇格で実行し、app の node_modules に symlink を確認。
  - update: 2026-01-13 14:05 JST app typecheck エラー対応として MapPage/worker-runtime/gis-sdk/runtime-worker/location-plugin の型修正と turf 依存整理を実施。`pnpm i`（権限昇格）後、`pnpm --filter @hierarchidb/app typecheck` が成功。
  - update: 2026-01-13 14:30 JST GitHub Pages での iso3166 CSV 取得パス修正として resolveIso3166CsvUrl を追加し、各利用箇所の既定 URL を BASE_URL 連動へ置換。
  - update: 2026-01-13 14:50 JST GitHub Pages で BASE_URL が dist 依存に反映されないケースに対応するため、resolveIso3166CsvUrl に document.baseURI/ window.location のフォールバックを追加し、`pnpm --filter @hierarchidb/gen-iso3166-2 build` を実行。
  - update: 2026-01-13 15:10 JST VITE_BASE_URL の明示設定を追加し、resolveIso3166CsvUrl が VITE_BASE_URL/BASE_URL を優先参照するように拡張。`pnpm --filter @hierarchidb/gen-iso3166-2 build` を再実行。

2138) fix/auth/dialog-loop-shape (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/auth/dialog-loop-shape
- 依存: なし
- 受け入れ基準: shape-plugin の認証ダイアログが新UIに統一され旧ダイアログが出ない／認証後に新ダイアログが再表示されず次へ進める／`Cancel (Back to Step 2)` で Step2 に遷移しループしない／localhost と GitHub Pages の双方で再現しない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/ui/auth/src/components/AuthProviderDialog.tsx`, `plugins/shape-plugin/src/ui/**`, `packages/plugin-base/src/hooks/useDialogUrlSync.ts`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、旧ダイアログ/現行遷移仕様へ戻す
- チェックリスト:
  - 旧/新ダイアログの表示条件を調査し重複経路を特定する
  - shape-plugin の認証表示を新ダイアログへ統一する
  - Cancel の Step2 遷移が URL/内部ステップと整合するよう調整する
  - 影響範囲と検証結果を運用ログに記載する
- 運用ログ：
  - start: 2026-01-13 16:10 JST 認証ダイアログの二重表示とキャンセル遷移ループの修正に着手。
  - update: 2026-01-13 16:35 JST useDialogUrlSync のパス解析と AuthRequiredDialogHost のキャンセル遷移を修正し、shape の旧認証ダイアログ表示を停止。AuthRequiredDialog に「Continue」導線を追加。
  - update: 2026-01-13 17:05 JST CORS proxy を dev/prod 共通運用に統一するため、VITE_CORS_PROXY_BASE_URL の既定値を base.sh に追加し、development.sh の dev URL を削除。app/.env.production に共通 URL を追記。

2139) fix/shape/zoom-band-ui (P1) — 進行中 (2026-01-13)
- ブランチ名: fix/shape/zoom-band-ui
- 依存: なし
- 受け入れ基準: toolbar-menu の共通ズーム率UIが削除され、band0 z0-3 / band1 z3-6 / band2 z6-9 / band3 z9-11(optional) の表示に置換される／shape Step4 のズーム関連UI（範囲/分割/区切り）が削除され、同バンド表示に置換される／設定・型・ロジックから tileConfig.minZoom/maxZoom/zoomBreakpoints が削除される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/components/TreeConsoleToolbarContent.tsx`, `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`, `plugins/shape-plugin/src/ui/hooks/useTileConfigSection.ts`, `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`, `plugins/shape-plugin/src/services/batch/useBatchSessionActions.ts`, `plugins/shape-plugin/src/common/types/**`, `plugins/shape-plugin/src/services/utils/utils.ts`, `plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 上記差分を revert し、旧ズームUIと min/max/zoomBreakpoints を復帰する
- チェックリスト:
  - toolbar-menu の共通ズーム率UIを削除し、ズーム帯の説明へ置換する
  - shape Step4 のズーム関連UIを削除し、ズーム帯の説明へ置換する
  - tileConfig の min/max/zoomBreakpoints を型・設定・ロジックから削除する
  - 影響箇所の表示/挙動を確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-13 22:10 JST ズーム帯UIの統一と min/max/zoomBreakpoints の削除に着手。
  - done: 2026-01-13 23:05 JST toolbar と Step4 のズームUIをズーム帯表示へ置換し、tileConfig から min/max/zoomBreakpoints を削除。

2140) fix/shape/progress-state-unify (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/progress-state-unify
- 依存: なし
- 受け入れ基準: currentState/currentTask と status/buildStatus の二重化を整理し、不要な重複は一本化する／進捗ログとUIのステージ表示が一致する／Step5 transform のLRUSplitPaneに failed/skipped の集計が表示される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `packages/ui/lru-splitview/src/types/LRUSplitView.ts`, `packages/ui/lru-splitview/src/utils/lruUtils.ts`（必要に応じて）
- ロールバック手順: 上記差分を revert し、旧表示/旧ログに戻す
- チェックリスト:
  - currentState/currentTask と status/buildStatus の用途を整理する
  - 進捗イベントの集計とUI表示を揃える
  - transform ステージで failed/skipped 件数を表示する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 00:20 JST progressState の二重化整理と transform の失敗/スキップ件数表示に着手。
  - done: 2026-01-14 00:55 JST 進捗ログの重複項目を整理し、LRUSplitPaneに failed/skipped 集計を表示するように更新。

2141) fix/auth/suspense-gated-steps (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/auth/suspense-gated-steps
- 依存: なし
- 受け入れ基準: shape Step3 / location Step3 / route Step3 / styler Step2 で認証判定を React Context + Suspense で同期的に扱い、UI 独自判定で認証ダイアログを出さない／AUTH_REQUIRED の通知のみで認証ダイアログが開く／bff-auth-user と bff-auth-token を完全撤去し localStorage を SSOT に統一／Worker 側は localStorage を直接読まず UI Storage Bridge を使用／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/contexts/SimpleBFFAuthContext.tsx`, `packages/ui/auth/src/services/BFFAuthService.ts`, `packages/ui/auth/src/hooks/useAuth.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`, `plugins/shape-plugin/src/ui/components/steps/ShapeCountrySelectionStep.tsx`, `plugins/location-plugin/src/ui/components/steps/LocationCountrySelectionStep.tsx`, `plugins/route-plugin/src/ui/components/steps/RouteCountrySelectionStep.tsx`, `plugins/styler-plugin/src/ui/components/steps/StylerCountrySelectionStep.tsx`（実装結果に応じて）
- ロールバック手順: 上記差分を revert し、旧認証判定/旧 storage キー運用へ戻す
- チェックリスト:
  - 認証判定を Suspense で同期的に扱うゲートを各 Step に導入する
  - AUTH_REQUIRED 通知のみで認証ダイアログが開くよう UI 判定を撤去する
  - bff-auth-user / bff-auth-token の保存・参照・削除を全撤去する

2142) fix/shape/step4-6-ui-terminology (P2) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-6-ui-terminology
- 依存: なし
- 受け入れ基準: shape の Step4/5/6 UI から一次抽出/二次抽出/extract1/extract2 など旧用語を排除し、`docs/vt-pipeline-design.md` の Step4 表記（fetch/transform/vt）に準拠する／Step5/6 の進捗・削除操作・ラベルに旧用語が残らない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（該当UI文言）
- ロールバック手順: 該当差分を revert し、旧文言へ戻す
- チェックリスト:
  - Step4 の見出し/説明/操作ラベルを fetch/transform/vt に更新する
  - Step5/6 の進捗・削除操作の文言を fetch/transform/vt に更新する
  - `docs/vt-pipeline-design.md` の Step4 UI 表記と整合することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 09:30 JST Step4/5/6 UI の旧用語刷新に着手。
  - done: 2026-01-14 09:55 JST Step4/5/6 のUI文言を fetch/transform/vt に統一し、一次/二次抽出の表記を撤去。検証: 未実施。

2143) refactor/shape/step6-metadata-stage-stats (P1) — 進行中 (2026-01-14)
- ブランチ名: refactor/shape/step6-metadata-stage-stats
- 依存: なし
- ExecPlan: `plans/shape-metadata-stage-geometry-stats-execplan.md`
- 受け入れ基準: shape Step6 のメタデータ集計が fetch/transform/vt の新ステージ構成に基づいて集計される／集計結果がメタデータとして保存される／Step6 の表示カラムが新ステージ構成に一致する／旧ステージ名の集計/表示が残らない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/features/vectortile-store/src/tilesDb.ts`, `packages/runtime-worker/src/services/*`, `plugins/shape-plugin/src/services/**`, `plugins/shape-plugin/src/ui/**`（調査結果に応じて）
- ロールバック手順: 該当差分を revert し、既存のメタデータ集計/表示へ戻す
- チェックリスト:
  - ExecPlan を更新し、ステージ再編後の集計/保存/表示方針を明記する
  - 集計ロジックを fetch/transform/vt 構成へ作り直す
  - 集計結果を保存するスキーマ/保存経路を更新する
  - Step6 の表示カラムを新ステージ構成へ更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-14 10:20 JST Step6 のメタデータ集計/保存/表示の再設計に着手。
  - update: 2026-01-14 11:40 JST ExecPlan を fetch/transform/vt 前提で更新し、集計・保存・UI 列更新の実装を反映。
  - done: 2026-01-14 11:40 JST Step6 メタデータの集計/保存/表示を新ステージ構成に刷新。検証: 未実施。
  - UI Storage Bridge 経由での token 取得に統一する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:40 JST 認証判定の Suspense 化と storage 統一対応に着手。
  - update: 2026-01-14 02:05 JST AuthReadyGate を追加し、shape/location/route/styler の対象ステップを Suspense でゲート。bff-auth-user/token を撤去し localStorage SSOT に統一。AuthRequiredDialogHost の UI 判定を削除。
  - done: 2026-01-14 02:05 JST 認証判定の Suspense 化と storage 統一を完了。
  - update: 2026-01-14 02:20 JST ui-auth の import を ui-plugin-shell から直接参照へ変更し、各プラグインに ui-auth 依存を追加。プラグイン UI ロード失敗に起因する Stepper 非表示の修正に対応。
  - update: 2026-01-14 02:40 JST shape の countryAvailability worker に UI storage bridge を追加し、認証トークンが worker に渡らない問題を修正。

2141) fix/shape/progress-visual-consistency (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/progress-visual-consistency
- 依存: なし
- 受け入れ基準: build全体のFailed表示はLinearProgressがerror色になる／build全体の表示とLRUSplitPaneのステージ表示が矛盾しないように集計ロジックが統一される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`
- ロールバック手順: 上記差分を revert し、従来の色/集計へ戻す
- チェックリスト:
  - Failed時の全体進捗バーの色を error に統一する
  - 全体表示とLRUSplitPaneの集計が同じ基準で更新される
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:10 JST 進捗表示の色と集計整合の修正に着手。

2142) fix/shape/step4-delete-downloads-button (P1) — 進行中 (2026-01-14)
- ブランチ名: fix/shape/step4-delete-downloads-button
- 依存: なし
- 受け入れ基準: Step4 の「ダウンロード済みファイルを削除(n件)」ボタンが件数>0で有効化され、クリックで削除が実行され件数表示が更新される／0件時は無効のまま／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（Step4 UI/状態）、`plugins/shape-plugin/src/services/**`（削除処理経路）
- ロールバック手順: 該当差分を revert し、従来のボタン状態/削除挙動へ戻す
- チェックリスト:
  - ボタンのdisabled条件を件数>0に一致させる
  - クリック時に削除処理が呼ばれ、件数ラベルが更新される
  - 0件時の無効化を維持する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:25 JST Step4 の削除ボタンが無効な問題の修正に着手。
  - done: 2026-01-14 01:32 JST canDeleteRaw の条件からポリシー固定 false を除外し、件数>0で有効化されるよう修正。

2143) fix/shape/progress-tasktype-unify (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/progress-tasktype-unify
- 依存: なし
- 受け入れ基準: currentStage/currentTask を廃止して taskType に統合するか、残す場合は正当性をコードで説明できる／autoSubscribe/enablePollingFallback/isSubscribed の必要性をコードで説明できるか不要なら削除／Step5 の全体進捗が 0/0 へ揺れる表示をしない／LRUSplitPane の error/percent/checked/no-tasks の矛盾が解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/**`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`, `plugins/shape-plugin/src/ui/hooks/progress/**`, `packages/runtime-worker/src/services/**`（進捗通知）、関連する型定義
- ロールバック手順: 該当差分を revert し、現行の進捗通知/表示へ戻す
- チェックリスト:
  - currentStage/currentTask と taskType の発生箇所を洗い出す
  - 不要な進捗プロパティを削除または統合する
  - 0/0 表示の発生条件を除去する
  - LRUSplitPane 表示の矛盾を解消する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 01:40 JST Step5 進捗通知と表示の統合修正に着手。
  - done: 2026-01-14 02:10 JST taskType へ統合し、0/0 揺れ回避・LRUSplitPane 表示矛盾・タスク取得の不足を修正。

2144) fix/shape/progress-protocol-tasktype (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/progress-protocol-tasktype
- 依存: なし
- 受け入れ基準: worker→UI進捗プロトコルから currentStage/currentTask を廃止し taskType に統一する／送受信側と型定義が整合し型エラーが出ない／Step5の進捗表示が taskType で判定される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/BatchControlAPI.ts`, `packages/common/types/src/progress-types.ts`, `packages/features/batch/src/session/**`, `packages/runtime-worker/src/services/**`, `plugins/shape-plugin/src/**`, `packages/ui/batch/src/**`
- ロールバック手順: 該当差分を revert し、currentStage/currentTask を含む旧プロトコルに戻す
- チェックリスト:
  - currentStage/currentTask の送信元/受信先/型定義を洗い出す
  - 進捗イベントの taskType 統一へ置換する
  - UI表示と taskType の一致を確認する
  - autoSubscribe/enablePollingFallback/isSubscribed の用途を精査し、不要ならペイロードから除去する
  - 進捗購読の登録単位がUI側で1つのコールバックになっているか確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 02:20 JST 進捗プロトコルを taskType に統一する修正に着手。
  - update: 2026-01-14 03:05 JST 進捗購読のプロパティ整理と購読単位の確認に着手。
  - done: 2026-01-14 03:30 JST 進捗購読のpollingフォールバックと関連プロパティを撤去し、UI側の進捗状態をpush購読のみで統一。

2145) fix/shape/batch-task-schema-cleanup (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/batch-task-schema-cleanup
- 依存: なし
- 受け入れ基準: batchTasks の未使用インデックスを削除する／BatchTaskRecord/ShapeBatchTaskRecord/ShapeBatchTaskSummary の未使用プロパティを削除する／ShapeBatchTaskStatus と ProgressPhase の関係を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/shape-store/src/ShapeDB.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/plugin-service-api/src/types/shapeTypes.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `plugins/shape-plugin/src/worker/getBatchTaskSummaries.ts`
- ロールバック手順: 該当差分を revert し、batchTasks のインデックスとタスク型を元に戻す
- チェックリスト:
  - batchTasks の未使用インデックスを削除する
  - タスク型の未使用プロパティを削除する
  - task status の表記を ProgressPhase に揃える
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 04:05 JST batchTasks のインデックス整理とタスク型の簡素化に着手。
  - done: 2026-01-14 05:20 JST batchTasks インデックスを整理し、タスク status を queued に統一して不要プロパティを削除。

2146) fix/route/typecheck-batch-progress (P1) — 完了 (2026-01-14)
- ブランチ名: fix/route/typecheck-batch-progress
- 依存: なし
- 受け入れ基準: RouteBatchSession の未使用引数を削除して TS6133 を解消する／useRouteBatchProgress の percentage を number に統一して TS2322 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/route-plugin/src/services/RouteBatchSession.ts`, `plugins/route-plugin/src/ui/hooks/useRouteBatchProgress.ts`
- ロールバック手順: 該当差分を revert し、RouteBatchSession/useRouteBatchProgress を修正前に戻す
- チェックリスト:
  - 未使用引数の削除で TS6133 を解消する
  - percentage の型不整合を解消する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 05:30 JST route-plugin の typecheck エラー修正に着手。
  - done: 2026-01-14 05:35 JST 未使用引数を削除し、percentage を number に統一。

2147) fix/shape/typecheck-progress-hooks (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/typecheck-progress-hooks
- 依存: なし
- 受け入れ基準: shapeProgressMapping の未使用引数を削除して TS6133 を解消する／useShapeBuildStep の変数順序を修正して TS2448/TS2454 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeBuildStep.ts`
- ロールバック手順: 該当差分を revert し、progress hooks の修正前に戻す
- チェックリスト:
  - 未使用引数の削除で TS6133 を解消する
  - normalizedBuildStatus の参照順序を修正する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 05:45 JST shape-plugin の progress hooks typecheck エラー修正に着手。
  - done: 2026-01-14 05:50 JST toShapeProgress の引数削除と normalizedBuildStatus の宣言順を調整。

2148) fix/app/typecheck-batch-progress-tasktype (P1) — 完了 (2026-01-14)
- ブランチ名: fix/app/typecheck-batch-progress-tasktype
- 依存: なし
- 受け入れ基準: worker-runtime の BatchProgress 生成から currentStage/currentTask を除去し taskType を使用する／TS2353 を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/worker-runtime/worker.ts`
- ロールバック手順: 該当差分を revert し、BatchProgress の taskType 反映を修正前に戻す
- チェックリスト:
  - currentStage/currentTask を taskType に置換する
  - typecheck エラーが消えることを確認する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:00 JST worker-runtime の BatchProgress 型不整合修正に着手。
  - done: 2026-01-14 06:02 JST taskType へ置換し currentStage/currentTask を削除。

2149) fix/shape/auth-dialog-loop-step3 (P1) — 完了 (2026-01-14)
- ブランチ名: fix/shape/auth-dialog-loop-step3
- 依存: なし
- 受け入れ基準: Step3 の認証ダイアログは Worker からの認証失敗通知のみで開く／認証成功直後はダイアログが再表示されない／Worker 側のメタデータ取得は UI に待機表示→成功/失敗通知を返す／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`
- ロールバック手順: 該当差分を revert し、認証フローの挙動を修正前に戻す
- チェックリスト:
  - UI 側の認証判断を撤去し、Worker 結果を起点にする
  - 事前の認証プロンプトを廃止し 401 ベースで通知する
  - 復帰直後のダイアログ再表示を防止する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:15 JST Step3 認証ループ対策に着手。
  - done: 2026-01-14 06:35 JST 事前認証プロンプトを撤去し、メタデータ取得エラーを Worker から返すよう整理。

2150) fix/auth/token-ssot-localstorage (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/token-ssot-localstorage
- 依存: なし
- 受け入れ基準: AuthService の in-memory token を廃止し localStorage を SSOT にする／401 検知時に access_token を削除する／bff-auth-user を廃止して userinfo に統一する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `packages/ui/auth/src/services/BFFAuthService.ts`, `packages/ui/auth/src/hooks/useAuth.ts`
- ロールバック手順: 該当差分を revert し、トークン保持/ユーザ情報の保存を修正前に戻す
- チェックリスト:
  - AuthService の currentToken を撤去して storage 参照に統一する
  - 401 検知時に token を削除する
  - bff-auth-user を廃止し userinfo のみにする
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 06:50 JST トークン SSOT 化と bff-auth-user 廃止に着手。
  - done: 2026-01-14 07:05 JST AuthService の in-memory token を撤去し、userinfo に統一。

2151) fix/auth/remove-authsuccess-dispatch (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/remove-authsuccess-dispatch
- 依存: なし
- 受け入れ基準: AuthRequiredDialogHost から AuthSuccess/AuthCancelled の dispatch を撤去する／AuthService は AUTH_REQUIRED 通知後に待機せず例外で返す／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当差分を revert し、AuthSuccess/AuthCancelled の dispatch と awaitAuth の待機を復元する
- チェックリスト:
  - AuthRequiredDialogHost の success/cancel dispatch を削除する
  - AuthService.awaitAuth を即時例外で返す
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:20 JST AuthSuccess dispatch 経路の撤去に着手。
  - done: 2026-01-14 07:30 JST AuthRequired 通知後の即時例外化と UI 側 dispatch 撤去。

2152) fix/auth/worker-authrequired-ui-only (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/worker-authrequired-ui-only
- 依存: なし
- 受け入れ基準: Worker が AuthRequired を dispatch し UI が受信してのみ認証ダイアログを開く／AuthService が AuthSuccess/Cancelled を待機して再試行する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`
- ロールバック手順: 該当差分を revert し、AuthRequired 連携を修正前に戻す
- チェックリスト:
  - AuthService.awaitAuth の待機と再試行を復元する
  - AuthRequiredDialogHost の success/cancel dispatch を復元する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:40 JST Worker→UI AuthRequired フローの復元に着手。
  - done: 2026-01-14 07:45 JST AuthSuccess/Cancelled の dispatch と待機を復元。

2153) fix/auth/worker-authrequired-no-wait (P1) — 完了 (2026-01-14)
- ブランチ名: fix/auth/worker-authrequired-no-wait
- 依存: なし
- 受け入れ基準: AuthService.awaitAuth は AUTH_REQUIRED を dispatch したら即例外で終了する／Worker は UI storage ブリッジ経由のみでトークンを読む／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/auth-recovery/src/AuthService.ts`
- ロールバック手順: 該当差分を revert し、AUTH_REQUIRED 待機と直接 localStorage 参照を復元する
- チェックリスト:
  - awaitAuth を即例外化する
  - localStorage 直接参照を撤去する
  - 運用ログ start/done を追記する
- 運用ログ：
  - start: 2026-01-14 07:55 JST Worker 認証フローの待機撤去に着手。
  - done: 2026-01-14 08:00 JST AuthRequired 通知後に即例外で終了し、UIブリッジ経由のみでトークン参照。

2124) fix/ui-auth/auth-required-dialog-order-and-spinner (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/ui-auth/auth-required-dialog-order-and-spinner
- 依存: なし
- 受け入れ基準: AuthRequiredDialog のプロバイダー押下時ローディングは CircularProgress になる／ダイアログ本文の順序が「plugin requires auth」「token rejected」「signed in as」になる／本文先頭の警告アイコンを非表示にする／Continue ボタンを撤去する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/components/AuthRequiredDialog.tsx`
- ロールバック手順: 該当ファイルの差分を revert し、ダイアログ表示/順序/ボタンを修正前に戻す
- チェックリスト:
  - 認証プロバイダーボタンのローディング表示を CircularProgress に置換する
  - 本文の表示順と先頭アイコンの有無を調整する
  - Continue ボタンを削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:12 JST AuthRequiredDialog の表示順・スピナー・ボタン修正に着手。
  - update: 2026-01-11 22:16 JST ローディングを CircularProgress に変更し、本文順序と先頭アイコンを調整、Continue ボタンを削除。検証: 未実施。
  - done: 2026-01-11 22:16 JST AuthRequiredDialog の表示順・スピナー・ボタン修正を完了。

2123) fix/shape/typecheck-auth-headers (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/typecheck-auth-headers
- 依存: なし
- 受け入れ基準: `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerPool.ts` の Authorization 参照に起因する TS2339 が解消される／認証ヘッダーの取得ロジックは現状維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerPool.ts`
- ロールバック手順: 該当ファイルの差分を revert し、修正前の型エラー状態へ戻す
- チェックリスト:
  - Authorization ヘッダー取得の型エラー原因を特定する
  - 最小修正で typecheck を通す
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 22:05 JST shape-plugin の Authorization ヘッダー型エラー修正に着手。
  - update: 2026-01-11 22:08 JST getAuthHeaders の await を追加し Authorization 取得の型エラーを解消。検証: `pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
  - done: 2026-01-11 22:08 JST shape-plugin の typecheck エラー修正を完了。

2124) feat/ui/datasource-cache-clear (P1) — 進行中 (2026-01-12)
- ブランチ名: feat/ui/datasource-cache-clear
- 依存: なし
- 受け入れ基準: Step2 のデータソース選択画面に「選択中データソースのキャッシュ削除」ボタンが表示される／shape・route の双方でキャッシュ削除が動作し、成功/失敗が通知される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`（必要に応じて）
- ロールバック手順: 追加したボタンとキャッシュ削除処理の差分を revert し、従来の Step2 へ戻す
- チェックリスト:
  - shape/route の Step2 にキャッシュ削除ボタンを追加する
  - data source ごとのキャッシュ削除処理を実装する
  - 成功/失敗の通知を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 18:30 JST Step2 のデータソースキャッシュ削除ボタン実装に着手。
  - update: 2026-01-12 19:00 JST shape/route のキャッシュ削除ボタンとデータソース別削除処理を追加し、i18n と通知を接続。検証: 未実施。
  - update: 2026-01-12 19:20 JST location Step2 にキャッシュ削除ボタンを追加し、location データ削除と通知/i18n を接続。検証: 未実施。
  - update: 2026-01-12 19:40 JST Step2/Step5 の削除対象と有効条件を整理し、Step5 ボタンの無効化方針に着手。検証: 未実施。
  - update: 2026-01-12 20:00 JST shape/location の Step4 ダウンロード削除をポリシーで無効化。検証: 未実施。
  - update: 2026-01-12 20:20 JST vt パイプライン共通設計の棚卸しと矛盾補修に着手。検証: 未実施。
  - update: 2026-01-12 20:40 JST srcId/dstId 命名とリトライ方針、fetch実行責務を反映。検証: 未実施。
  - update: 2026-01-12 20:50 JST taskQueue UI 可視化は現行実装を踏襲する方針を明記。検証: 未実施。
  - update: 2026-01-12 21:00 JST fetch実行/記録の整合と taskQueue→LRUSplitPane 接続点の補強に着手。検証: 未実施。
  - update: 2026-01-12 21:20 JST vt-pipeline-design の taskQueue/図表整合と LRUSplitPane 接続記述の補強に着手。検証: 未実施。
  - update: 2026-01-12 21:35 JST vt-pipeline-design の taskQueue 記述と Mermaid 図を整合化し、LRUSplitPane 接続の説明を補強。検証: 未実施。
  - update: 2026-01-12 22:20 JST 新設計の用語/要件に合わせて vt ドキュメントと ExecPlan を更新。検証: 未実施。
  - update: 2026-01-12 22:30 JST shape-fetch の国コード基準を ISO2 として明文化。検証: 未実施。

2125) docs/shape-design-consistency-review (P2) — 進行中 (2026-01-12)
- ブランチ名: docs/shape-design-consistency-review
- 依存: なし
- 受け入れ基準: shape-plugin 設計ドキュメントの所在を特定し、当該ドキュメントのみを手掛かりに実装作業が一貫して進められるかを評価する／不足や曖昧な点を項目立てで指摘する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/**`, `plugins/shape-plugin/**`（調査対象）
- ロールバック手順: ドキュメント/ログの更新差分を revert し、調査着手前の状態へ戻す
- チェックリスト:
  - shape-plugin 設計ドキュメントの所在を確認する
  - 設計ドキュメントの不足点を項目立てで整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 21:45 JST shape-plugin 設計ドキュメントの実装一貫性レビューに着手。
  - done: 2026-01-12 22:05 JST shape-plugin 設計ドキュメントの不足/矛盾点を整理し、実装一貫性の観点で指摘をまとめた。検証: 該当ドキュメントの読解のみ。

2126) docs/shape-design-alignment (P2) — 進行中 (2026-01-12)
- ブランチ名: docs/shape-design-alignment
- 依存: なし
- 受け入れ基準: 旧仕様ドキュメントを obsolate に移動し、参照関係を更新する／新設計（shape-fetch/transform/vt）に合わせた補足（Step4設定要素、ISO2基準）を反映する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/**`
- ロールバック手順: 移動・更新したドキュメントの差分を revert し、元の配置へ戻す
- チェックリスト:
  - 旧仕様のドキュメントを obsolate に移動する
  - 参照リンクを新しいパスに更新する
  - 新設計の追加要素をドキュメントへ追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 22:35 JST 旧仕様ドキュメント移動と新設計整合の追記に着手。
  - done: 2026-01-12 22:50 JST 旧仕様ドキュメントを obsolate に移動し、参照リンクと Step4 設定要素/ISO2 方針を反映。検証: 未実施。

2128) docs/step4-structure-and-alignment (P2) — 進行中 (2026-01-13)
- ブランチ名: docs/step4-structure-and-alignment
- 依存: なし
- 受け入れ基準: Step4 の UI 構造を4階層ツリーで整理し、(A)-(D) の対応区分を記載する／TASKS.md に運用ログを記載する
- 影響範囲: `docs/vt-pipeline-design.md`
- ロールバック手順: 追記差分を revert し、追記前の状態へ戻す
- チェックリスト:
  - Step4 の UI 構造ツリーを追記する
  - (A)-(D) の対応区分を追記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-13 00:05 JST Step4 のUI構造ツリーと(A)-(D)整理の追記に着手。
  - done: 2026-01-13 00:20 JST Step4 のUI構造ツリーと(A)-(D)の対応区分を vt-pipeline-design に追記。検証: 未実施。
  - update: 2026-01-13 00:35 JST transform の格子スナップ→RDP の順序と解像度条件を追記。検証: 未実施。
  - update: 2026-01-13 00:50 JST transform の adminLevel 優先順位と stagePriority 付与を仕様に追記。検証: 未実施。
  - update: 2026-01-13 01:05 JST transform/vt の境界ライン保存とタイル生成への適用を追記。検証: 未実施。
  - update: 2026-01-13 01:15 JST vt ステージで boundary LineString のデデュープを追加で明記。検証: 未実施。
  - update: 2026-01-13 01:25 JST ui-map の admin-boundary 描画タスクを関連項目として追記。検証: 未実施。
  - update: 2026-01-13 01:35 JST boundary デデュープの実装メモを vt-pipeline-design に追記。検証: 未実施。
  - update: 2026-01-13 01:55 JST GeoBoundaries/GADM の ISO2→ISO3 変換例と boundary デデュープの高速キー化を追記。検証: 未実施。
  - update: 2026-01-13 02:15 JST taskQueue 優先度の運用と Step4 入力仕様の暫定整理を追記。検証: 未実施。
  - update: 2026-01-13 02:35 JST Step4 の高度な設定扱いと extractionMode 削除を反映。検証: 未実施。
  - update: 2026-01-13 03:00 JST 簡略化 tolerance の4分類と座標系の橋渡し前提を追記。検証: 未実施。
  - update: 2026-01-13 03:20 JST WebMercator(meters) での tolerance 計算式とコード例を追記。検証: 未実施。
  - update: 2026-01-13 03:40 JST 簡略化強度のUI表記とk=1.0既定、route tolerance 範囲/既定値を反映。検証: 未実施。
  - update: 2026-01-13 04:05 JST 印刷用途を含む解像度基準（extent=4096/表示px=256/512）を明文化する追記に着手。検証: 未実施。
  - update: 2026-01-13 04:15 JST MVT extent=4096 を格子基準とし、印刷/表示は tileSize+pixelRatio で制御する旨を追記。検証: 未実施。
  - update: 2026-01-13 04:25 JST maplibre-gl-export の印刷向け pixelRatio/DPI ガイド追記に着手。検証: 未実施。
  - update: 2026-01-13 04:35 JST Step4 UI ツリーに簡略化強度（Transform/VT）の配置を具体化する追記に着手。検証: 未実施。
  - update: 2026-01-13 04:45 JST Step4 UI ツリーへ Transform/VT 簡略化強度の配置（shape/route）を追記。検証: 未実施。
  - update: 2026-01-13 04:55 JST Step4 入力仕様に Transform/VT の簡略化強度（shape/route）の範囲/既定値を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:05 JST Step4 入力仕様へ Transform/VT 簡略化強度の項目（shape/route）を追加。検証: 未実施。
  - update: 2026-01-13 05:15 JST Step4 入力仕様の既定値出典を現行実装に合わせて補正。検証: 未実施。
  - update: 2026-01-13 05:25 JST Step4 既存UIと新設計の衝突点一覧を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:30 JST Step4 既存UIと新設計の衝突点（tolerance系中心）を整理して追記。検証: 未実施。
  - update: 2026-01-13 05:40 JST Step4 衝突点の優先度（P1/P2/P3）と理由を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 05:45 JST Step4 衝突点の優先度を付与し、理由を併記。検証: 未実施。
  - update: 2026-01-13 05:55 JST Step4 衝突点の削除/残置/移行判断を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 06:00 JST Step4 衝突点に削除/残置/移行判断を追記。検証: 未実施。
  - update: 2026-01-13 06:10 JST 新設計に合わせた UI 文言変更項目の棚卸しに着手。検証: 未実施。
  - update: 2026-01-13 06:15 JST Step4 UI 文言の置換表（新設計用語）を追記。検証: 未実施。
  - update: 2026-01-13 06:25 JST Step4 入力項目のUI表記（日本語/英語）案を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 06:30 JST Step4 UI 表記案（日本語/英語）を shape/route で追記。検証: 未実施。
  - update: 2026-01-13 06:40 JST 文言置換表とUI表記案の統合整理に着手。検証: 未実施。
  - update: 2026-01-13 06:45 JST 文言置換表とUI表記案を統合し、旧→新と最終表記を整理。検証: 未実施。
  - update: 2026-01-13 06:55 JST 旧用語（Legacy 等）の整理方針追記に着手。検証: 未実施。
  - update: 2026-01-13 07:00 JST 旧用語（Legacy 等）の整理方針を Step4 文書に追記。検証: 未実施。
  - update: 2026-01-13 07:10 JST 旧表記に依存する説明文の差し替え整理に着手。検証: 未実施。
  - update: 2026-01-13 07:15 JST 旧表記に依存する説明文の差し替え対象と新文面を追記。検証: 未実施。
  - update: 2026-01-13 07:25 JST Step4 入力項目名と説明文の対応表追記に着手。検証: 未実施。
  - update: 2026-01-13 07:30 JST Step4 入力項目名と説明文の対応表（shape/route）を追記。検証: 未実施。
  - update: 2026-01-13 07:40 JST Step4 入力仕様とUI表記案の整合微修正に着手。検証: 未実施。
  - update: 2026-01-13 07:45 JST Step4 入力仕様/表記の整合修正（route移行方針とlegacy記述）を反映。検証: 未実施。
  - update: 2026-01-13 07:55 JST 説明文の移行方針整合（legacy/新設計併存）を反映する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:00 JST 説明文に移行中の注意文を追記し、legacy/新設計併存の整合を反映。検証: 未実施。
  - update: 2026-01-13 08:10 JST Legacy controls（旧Extract互換）の別枠整理案追記に着手。検証: 未実施。
  - update: 2026-01-13 08:15 JST Legacy controls（旧Extract互換）の別枠整理案を追記。検証: 未実施。
  - update: 2026-01-13 08:25 JST Step4 UI 構造ツリーに Legacy controls 集約の注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:30 JST Step4 UI 構造ツリーに Legacy controls を Advanced Settings へ集約する注記を追記。検証: 未実施。
  - update: 2026-01-13 08:40 JST Legacy controls のUI補足文（旧互換）を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 08:45 JST Legacy controls のUI補足文（旧互換/Advanced Settings）を追記。検証: 未実施。
  - update: 2026-01-13 08:55 JST Legacy controls 対象項目へのタグ付け追記に着手。検証: 未実施。
  - update: 2026-01-13 09:00 JST Legacy controls 対象項目にタグ付け（UI表記案）を追記。検証: 未実施。
  - update: 2026-01-13 09:10 JST Legacy controls 対象項目の説明文対応表へ注記追加に着手。検証: 未実施。
  - update: 2026-01-13 09:15 JST Legacy controls 対象項目に Advanced Settings 注記を説明文対応表へ追記。検証: 未実施。
  - update: 2026-01-13 09:25 JST Step4 入力仕様へ Legacy controls（Advanced Settings）注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 09:30 JST Step4 入力仕様の Legacy controls 項目へ Advanced Settings 注記を追記。検証: 未実施。
  - update: 2026-01-13 09:35 JST Legacy controls の注記とUI構造の整合を確認し、対応区分の文言を補正。検証: 未実施。
  - update: 2026-01-13 09:45 JST route の Advanced Settings に Legacy controls なしの注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 09:50 JST route の Advanced Settings に Legacy controls なしの注記を追記。検証: 未実施。
  - update: 2026-01-13 10:00 JST route 入力仕様の legacy/new 併記整理に着手。検証: 未実施。
  - update: 2026-01-13 10:05 JST route 入力仕様の legacy/new 併記を現行/移行後で整理。検証: 未実施。
  - update: 2026-01-13 10:15 JST shape 入力仕様の legacy/new 併記整理に着手。検証: 未実施。
  - update: 2026-01-13 10:20 JST shape 入力仕様の legacy/new 併記を現行/移行後で整理。検証: 未実施。
  - update: 2026-01-13 10:30 JST Step4 入力仕様の先頭に Legacy controls 一覧を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 10:35 JST Step4 入力仕様の先頭に Legacy controls 一覧を追記。検証: 未実施。
  - update: 2026-01-13 10:45 JST Legacy controls 一覧に対応注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 10:50 JST Legacy controls 一覧に UI 構造/表記/説明文との対応注記を追記。検証: 未実施。
  - update: 2026-01-13 11:00 JST Step4 入力仕様の非Legacy項目を簡潔に再整理する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:05 JST Step4 入力仕様に非Legacy項目の要約を追記。検証: 未実施。
  - update: 2026-01-13 11:15 JST Step4 入力仕様の詳細を fetch/transform/vt の順で読みやすくする修正に着手。検証: 未実施。
  - update: 2026-01-13 11:20 JST Step4 入力仕様の詳細に fetch/transform/vt の小見出しを追加し読みやすく整理。検証: 未実施。
  - update: 2026-01-13 11:30 JST route 入力仕様に task split の小見出しと項目を明記する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:35 JST route 入力仕様に task split の小見出しと項目を追記。検証: 未実施。
  - update: 2026-01-13 11:45 JST shape 入力仕様に task split の小見出しと項目を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 11:50 JST shape 入力仕様に task split の小見出しと項目を追記。検証: 未実施。
  - update: 2026-01-13 12:00 JST task split と Advanced Settings の相互参照注記を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 12:05 JST task split 項目に Advanced Settings 参照注記を追記。検証: 未実施。
  - update: 2026-01-13 12:15 JST UI 構造ツリーの Legacy controls を Advanced Settings に集約し、重複配置を解消。検証: 未実施。
  - update: 2026-01-13 12:25 JST Legacy controls の注記とUI構造整合を明示する文言を追記。検証: 未実施。
  - update: 2026-01-13 12:30 JST Legacy controls の注記にUI構造側の整合（重複なし）を明記。検証: 未実施。
  - update: 2026-01-13 12:40 JST Step4 入力仕様周辺の冗長表現整理に着手。検証: 未実施。
  - update: 2026-01-13 12:45 JST Step4 入力仕様の Legacy controls 注記を簡潔化して重複を削減。検証: 未実施。
  - update: 2026-01-13 12:55 JST 非Legacy要約に詳細参照の注記を追加する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:00 JST 非Legacy要約に詳細参照の注記を追記。検証: 未実施。
  - update: 2026-01-13 13:10 JST Step4 入力仕様の利用ガイド（要約→詳細→UI構造）を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:15 JST Step4 入力仕様の使い方ガイド（要約→詳細→UI構造）を追記。検証: 未実施。
  - update: 2026-01-13 13:25 JST 旧用語の削除タイミングを簡潔に追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 13:30 JST 旧用語の削除タイミング（旧Extract削除完了+移行後適用確認）を追記。検証: 未実施。
  - update: 2026-01-13 13:40 JST 移行後に有効化する項目のチェックリスト追記に着手。検証: 未実施。
  - update: 2026-01-13 13:45 JST 移行後に有効化する項目のチェックリストを追記。検証: 未実施。
  - update: 2026-01-13 13:55 JST 移行後チェックリストとTASKS運用のリンク文を追記する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:00 JST 移行後チェックリストに TASKS 運用ログ記録の注記を追記。検証: 未実施。
  - update: 2026-01-13 14:10 JST Step4 入力仕様が最終仕様ソースである旨を明記する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:15 JST Step4 入力仕様が最終仕様ソースである旨を追記。検証: 未実施。
  - update: 2026-01-13 14:25 JST 他ドキュメントの重複記述を参照表記へ置換する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:30 JST vt-shape/vt-route の Step4 に入力仕様の参照先を追記。検証: 未実施。
  - update: 2026-01-13 14:35 JST vt-shape/vt-route/location-route の Step4 参照注記を追加し重複記述を抑制。検証: 未実施。
  - update: 2026-01-13 14:45 JST Step4 の「Processing Settings」を「Build Settings」に統一する作業に着手。検証: 未実施。
  - update: 2026-01-13 14:50 JST Step4 の「Processing Settings」を「Build Settings」に統一。検証: 未実施。
  - update: 2026-01-13 15:00 JST 置換表から旧表記を削除し Build Settings 表記に整理する作業に着手。検証: 未実施。
  - update: 2026-01-13 15:05 JST 置換表から旧表記を削除し Build Settings 表記のみに整理。検証: 未実施。
  - update: 2026-01-13 15:15 JST UI 表記セクションの見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:20 JST UI 表記セクション見出しを「最終版」に簡潔化。検証: 未実施。
  - update: 2026-01-13 15:30 JST Step4 衝突点セクション見出しの簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:35 JST Step4 差分・移行点セクションに簡潔化と説明文を反映。検証: 未実施。
  - update: 2026-01-13 15:45 JST Legacy controls 見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 15:50 JST Legacy controls 見出しを簡潔化し説明文を追加。検証: 未実施。
  - update: 2026-01-13 16:00 JST 非Legacy要約見出しの簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 16:05 JST 非Legacy要約見出しを簡潔化。検証: 未実施。
  - update: 2026-01-13 16:15 JST 入力項目の対応表見出し簡潔化に着手。検証: 未実施。
  - update: 2026-01-13 16:20 JST 入力項目の対応表見出しを簡潔化。検証: 未実施。
  - update: 2026-01-13 16:35 JST Step4 入力仕様セクションを全体再編（Legacy/非Legacy/移行/表記/詳細/説明）し、重複を統合。検証: 未実施。
  - update: 2026-01-13 16:40 JST location-route 設計差分ドキュメントの Step4 参照を統一（vt-pipeline 参照）。検証: 未実施。
  - update: 2026-01-13 16:50 JST Step4 補足セクションを簡潔化し、UI表記と整合する形に再整理。検証: 未実施。
  - update: 2026-01-13 17:00 JST 再実行/再利用の判定計画（fetch/transform/vt）を明文化。検証: 未実施。
  - update: 2026-01-13 17:10 JST 判定キーのハッシュ対象項目と正規化ルールを追記。検証: 未実施。
  - update: 2026-01-13 17:15 JST ハッシュ用シリアライズ形式（JSONキー順固定）を追記。検証: 未実施。
  - update: 2026-01-13 17:20 JST taskId 構成例に hash を含める拡張例を追記。検証: 未実施。
  - update: 2026-01-13 17:30 JST 再実行/再利用の実装手順（taskQueue更新）とFGB保存先再掲を追記。検証: 未実施。
  - update: 2026-01-13 17:40 JST fetch-shape は URL を smartFetch キーとして扱う前提を追記。検証: 未実施。
  - update: 2026-01-13 17:45 JST ハッシュ生成は既存の SHA3 実装を使用する方針を追記。検証: 未実施。
  - update: 2026-01-13 17:50 JST band3 上限超過はエラー扱い、Step3 判定依存、vt-store 保存キー連結方式を追記。検証: 未実施。
  - update: 2026-01-13 17:55 JST band3 上限超過エラーは安全策・非サポートである旨を明記。検証: 未実施。
  - update: 2026-01-13 18:00 JST vt-store 保存キーの区切り文字例を追記。検証: 未実施。

2129) feat/shape/vt-pipeline-implementation (P1) — 進行中 (2026-01-13)
- ブランチ名: feat/shape/vt-pipeline-implementation
- 依存: なし
- 受け入れ基準:
  - shape-fetch/transform/vt の新仕様に沿って実装が更新される
  - taskQueue の状態更新ルール（waiting/running/completed/failed + message 前置詞）が反映される
  - vt-shape-store/vt-store のデータ保存が設計に一致する
  - TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/**`, `packages/vt-orchestrator/**`, `packages/features/shape-store/**`（調査後に絞り込み）
- ロールバック手順: 追加・変更した差分を revert し、旧パイプラインへ戻す
- チェックリスト:
  - 設計ドキュメントを再読し実装の不足点を洗い出す
  - shape-fetch/transform/vt の実装差分を確定する
  - taskQueue 記録・進捗更新を現行UIと整合させる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-13 18:20 JST shape-plugin の新 vt パイプライン実装に着手。
  - update: 2026-01-13 18:30 JST ExecPlan 作成に着手（shape-plugin 新実装の作業計画策定）。検証: 未実施。
  - update: 2026-01-13 18:45 JST ExecPlan を作成し `plans/shape-vt-pipeline-implementation-execplan.md` を追加。検証: 未実施。
  - update: 2026-01-13 19:05 JST vt-store/vt-shape-store/vt-orchestrator の雛形パッケージと tsconfig base のエイリアスを追加。検証: 未実施。
  - update: 2026-01-13 19:30 JST vt-shape-store の Dexie スキーマ/Query/Mutation を雛形実装として追加。検証: 未実施。
  - update: 2026-01-13 20:00 JST vt-store の Dexie スキーマ/VTQueryAPI/VTMutationAPI を雛形実装として追加。検証: 未実施。
  - update: 2026-01-13 20:25 JST vt-orchestrator の taskQueue（Dexie 永続化 + in-memory 通知）雛形を追加。検証: 未実施。
  - update: 2026-01-13 20:45 JST vt-orchestrator の runStageTasks 雛形を追加（waiting→running→completed/failed 遷移）。検証: 未実施。
  - update: 2026-01-13 21:20 JST vt-orchestrator に transform/vt の基本ハンドラ（簡略化・tileIndex生成・band3予約・vt生成）を追加。検証: 未実施。
  - update: 2026-01-13 22:10 JST shape-fetch の taskQueue 登録と stage1Buffers 保存の土台（shapeFetchStage）を追加。検証: 未実施。
  - update: 2026-01-13 22:15 JST fetchData の cacheKey を URL で使えるよう dataSource 戦略を更新し、GADM の ISO3 設定を修正。検証: 未実施。
  - update: 2026-01-13 22:40 JST shape-fetch/transform/vt を直列実行する shapePipeline を追加し、taskQueue 進捗を worker へ結線。検証: 未実施。
  - update: 2026-01-13 23:10 JST worker/api の getBatchSessionStatus と getProcessingStatus を taskQueue 優先に切替。検証: 未実施。
  - update: 2026-01-13 23:25 JST worker/api から batchSessionManager フォールバックを削除し、taskQueue のみで進捗/状態を管理。検証: 未実施。
  - update: 2026-01-14 00:05 JST Step5 の pause/resume を無効化し、UI と worker API から旧 batch セッション操作/回復 UI を削除。検証: 未実施。
  - update: 2026-01-14 00:20 JST 旧 batch セッションの実装群（SessionController/BatchSessionManager/SessionTaskRegistry 等）と関連テストを削除。検証: 未実施。
  - update: 2026-01-14 00:45 JST vt-orchestrator/shape-plugin の型エラーを解消し typecheck を再実行。検証: `pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
  - update: 2026-01-14 01:10 JST worker-runtime の pause/resume 経路を shape では no-op 化し、shape-plugin README から旧 batch セッション記述を整理。検証: 未実施。

2127) feat/shape/step5-three-stage-columns (P2) — 進行中 (2026-01-12)
- ブランチ名: feat/shape/step5-three-stage-columns
- 依存: なし
- 受け入れ基準: Step5 の LRUSplitPane が fetch/transform/vt の3列になっている／旧ステージ名が混在しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/components/src/BuildStep.tsx`, `plugins/shape-plugin/src/ui/locales/**`
- ロールバック手順: Step5 のステージ定義と進捗表示の差分を revert し、4列構成へ戻す
- チェックリスト:
  - Step5 のステージ定義を fetch/transform/vt の3列に更新する
  - 進捗集計とクラッシュ警告のステージ名を新仕様に合わせる
  - i18n ラベルを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-12 23:05 JST Step5 の3列化とステージ名更新に着手。
  - done: 2026-01-12 23:30 JST Step5 のステージを fetch/transform/vt の3列に更新し、進捗集計と警告表示のステージ名を整合。検証: 未実施。

2122) fix/auth/localstorage-only-worker-bridge (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/auth/localstorage-only-worker-bridge
- 依存: なし
- 受け入れ基準: 認証関連の sessionStorage 利用が完全に撤去され localStorage に統一される／Worker 側から UI の localStorage を操作できるブリッジ API が追加される／auth フローが sessionStorage なしで動作する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/auth/src/**`, `packages/features/auth-recovery/src/**`, `app/src/contexts/WorkerProvider.tsx`, `app/src/worker-runtime/**`（調査後に絞り込み）
- ロールバック手順: auth の localStorage 統一差分と Worker ブリッジ追加差分を revert し、従来の sessionStorage 併用へ戻す
- チェックリスト:
  - 認証関連の sessionStorage 参照/書き込みを削除する
  - localStorage への統一と型の厳格化を反映する
  - Worker→UI の localStorage ブリッジ API を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 20:35 JST sessionStorage 全廃・localStorage 統一と Worker ブリッジ追加に着手。
  - update: 2026-01-11 21:25 JST auth 関連の sessionStorage を localStorage へ統一し、Worker→UI の localStorage ブリッジ API を追加。検証: 未実施。

2123) fix/shape/preview-zoom-snackbar (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/preview-zoom-snackbar
- 依存: なし
- 受け入れ基準: Shape Step6 プレビューでズーム操作時に Snackbar で現在のズーム値が表示される／他の Snackbar 表示を阻害しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`
- ロールバック手順: 追加したズーム Snackbar 表示の差分を revert し、従来の表示へ戻す
- チェックリスト:
  - ズーム変更イベントを取得する
  - Snackbar でズーム値を表示する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 21:35 JST Step6 プレビューでズーム値を Snackbar 表示する対応に着手。

2118) fix/app/treetable-skeleton-until-columns-ready (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/treetable-skeleton-until-columns-ready
- 依存: なし
- 受け入れ基準: TreeTableCore 表示時にカラム幅調整完了までは TreeTableConsole の本体が MUI Skeleton 表示になる／調整完了後に実データ表示へ切り替わる／/t/... の初回表示でコンテンツの激しい動揺が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/**`（調査後に絞り込み）
- ロールバック手順: TreeTableConsole の Skeleton 表示差分を revert し、従来の即時表示へ戻す
- チェックリスト:
  - TreeTableCore/TreeTableConsole でカラム幅安定化の検知ポイントを特定する
  - 安定化完了まで Skeleton 表示に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 17:05 JST TreeTableCore のカラム幅安定化前に Skeleton 表示へ切替する対応に着手。
  - update: 2026-01-11 17:20 JST カラム幅の計測完了までは Skeleton を表示し、完了後に本体表示へ切替するよう実装。検証: 未実施。

2119) fix/app/tree-node-info-panel-i18n (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/tree-node-info-panel-i18n
- 依存: なし
- 受け入れ基準: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx` の表示文言が i18n 経由になる／既存の挙動と文言の意味が変わらない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: i18n 化の差分を revert し、従来の固定文言へ戻す
- チェックリスト:
  - TreeNodeInfoPanel の固定文言を抽出する
  - i18n キーへ置換し既存文言をデフォルト値に設定する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 18:05 JST TreeNodeInfoPanel の i18n 化対応に着手。
  - update: 2026-01-11 18:10 JST Draft/Created/Updated ラベルを i18n 経由に置換。検証: 未実施。
  - update: 2026-01-11 18:20 JST TreeNodeInfoPanel のボタン/ラベル文言をロケール辞書へ追加し i18n 化を補完。検証: 未実施。

2120) feat/app/tree-console-contextmenu-build (P1) — 完了 (2026-01-11)
- ブランチ名: feat/app/tree-console-contextmenu-build
- 依存: なし
- 受け入れ基準: styler/shape/location/route/folder のノードでコンテキストメニューに Build が表示される／アイコンは Construction でラベルは i18n 化される／ビルド起動は TreeNodeInfoPanel と同じ導線で実行される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/breadcrumb/src/components/NodeContextMenu.tsx`, `app/src/hooks/treeconsole/actions/contextMenu.ts`, `app/src/router/pages/tree/console/**`, `app/public/locales/**`, `packages/ui/i18n/public/locales/**`
- ロールバック手順: 追加した Build メニュー項目とアクションの差分を revert し、従来のコンテキストメニューに戻す
- チェックリスト:
  - Build メニュー項目の表示条件（nodeType 判定）を実装する
  - ContextMenu の Build クリックでビルド導線を開始する
  - i18n ラベルを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 19:00 JST TreeConsole のコンテキストメニューに Build を追加する対応に着手。
  - update: 2026-01-11 19:40 JST Build メニュー項目の表示条件・i18n・ビルド導線を接続。検証: 未実施。
  - done: 2026-01-11 19:45 JST Build メニューの結線と TreeNodeInfoPanel 経路の共通化まで完了。検証: 未実施。

2121) fix/app/tree-node-info-panel-width-align-searchfield (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/tree-node-info-panel-width-align-searchfield
- 依存: なし
- 受け入れ基準: TreeConsole の TreeNodeInfoPanel 表示時に横幅が SearchField と一致する／他画面や他パネルのレイアウトに影響がない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `packages/ui/search-field/src/SearchField.tsx`（必要に応じて）
- ロールバック手順: 追加した幅調整差分を revert し、従来の幅へ戻す
- チェックリスト:
  - SearchField の幅仕様を確認する
  - TreeNodeInfoPanel の幅を SearchField に揃える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 19:20 JST TreeNodeInfoPanel の幅を SearchField に揃える対応に着手。
  - update: 2026-01-11 19:30 JST SearchField の幅定数をエクスポートし TreeNodeInfoPanel の max/min 幅を揃えるよう調整。検証: 未実施。
  - update: 2026-01-11 20:05 JST TreeConsole の split view カラム幅を SearchField と同じ 281-420px に調整。検証: 未実施。

2122) docs/shape-step5-batch-modeling (P1) — 進行中 (2026-01-11)
- ブランチ名: docs/shape-step5-batch-modeling
- 依存: なし
- 受け入れ基準: Step5 の extract2/vectortile 処理をモデル化して I/O/CPU/メモリの流れとボトルネック仮説を整理する／改善方向の候補を列挙する／着手優先度の判断材料を示す／TASKS.md に運用ログを記載する
- 影響範囲: ドキュメント/調査（コード変更なし）
- ロールバック手順: 記載した検討内容を削除する
- チェックリスト:
  - 現状の処理モデル（タスク単位・データ流・永続化）を整理する
  - ボトルネック仮説と改善方向を整理する
  - 着手優先度の判断材料を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 20:30 JST shape Step5 のバッチ処理モデル化に着手。
  - update: 2026-01-11 21:10 JST vt ステージ名への移行方針（併存なし/データ破棄/帯3はOFF）を前提にデータモデル設計を整理。検証: 未実施。
  - update: 2026-01-11 21:25 JST 帯内は最小zのみインデックス化・vtタスクの上限導入・帯別featureIdユニーク化・band3対象条件を反映する設計更新に着手。検証: 未実施。
  - update: 2026-01-11 21:40 JST tileIndexBand のテーブル設計と vt タスク分割ルール（maxBuffers/maxVertices）案を整理。検証: 未実施。
  - update: 2026-01-11 22:00 JST band3 の自動ON条件を「いずれかの国で自治体レベル2以上を選択した場合」に更新し、対象国限定の実行ルールを明文化。検証: 未実施。
  - update: 2026-01-11 22:10 JST band3 の重複・一貫性方針として、extract 時にBBox→z9タイル集合へ変換し vt タスク予約を行う設計を追記。検証: 未実施。
  - update: 2026-01-11 22:25 JST band3 予約の軽量永続化（重複排除/上限管理）と固定タスク生成時の追加投入フローを追記。検証: 未実施。
  - update: 2026-01-11 22:45 JST TileId/TileBBox 変換コードと一気移行の作業手順を文書へ追記。検証: 未実施。
  - update: 2026-01-11 23:10 JST shape-vt ドキュメントを実装者向けに再構成し、DBスキーマ/タスクpayload/分割ルール/座標系を追記。検証: 未実施。
  - update: 2026-01-11 23:30 JST vt-store/vt-shape-store/vt-orchestrator の再編成方針と旧実装の削除方針を追記。検証: 未実施。
  - update: 2026-01-11 23:45 JST vt-store API 互換維持と vt-route-store/location-store の追加整理、vt 完全稼働後の旧実装削除方針を追記。検証: 未実施。
  - update: 2026-01-12 00:10 JST 共通/差分ドキュメントを vt-pipeline-design.md / vt-shape-pipeline-design.md / vt-route-pipeline-design.md に分割。旧ファイルは移動案内に差し替え。検証: 未実施。
  - update: 2026-01-12 09:10 JST shape/route の fetch ステージ命名変更と smartFetch/責務分担の共通化を反映する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:20 JST shape-fetch/route-fetch 命名と smartFetch/責務分担を共通ドキュメントに反映し、shape/route 差分ドキュメントも更新。検証: 未実施。
  - update: 2026-01-12 09:30 JST stage1Buffers への共通名統一を反映する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:35 JST stage1Buffers への共通名統一を shape/route 差分ドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 09:45 JST stage1Buffers の命名をスキーマ/保存単位/識別キー観点で追記する作業に着手。検証: 未実施。
  - update: 2026-01-12 09:55 JST stage1Buffers の共通スキーマと domainType/sourceKey を明記し、shape/route での値の例を追記。検証: 未実施。
  - update: 2026-01-12 10:10 JST vt パイプライン3ドキュメントを通読し、不備・不足の補強に着手。検証: 未実施。
  - update: 2026-01-12 10:25 JST 用語/責務/タスクpayload/入出力/ストア分担/中間ストア寿命/簡略化/ObsolateBuildConfig を追記し、shape/route差分へタスク単位と band3 条件を補強。検証: 未実施。
  - update: 2026-01-12 10:35 JST extract ステージ名を transform に統一する作業に着手。検証: 未実施。
  - update: 2026-01-12 10:45 JST transform ステージ名の統一を共通/差分ドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 10:55 JST パッケージ責務と旧実装の移行対応表の補強に着手。検証: 未実施。
  - update: 2026-01-12 11:05 JST パッケージ責務の明文化と旧実装対応表を共通設計へ追記し、shape/route 差分に旧ストアの注釈を追加。検証: 未実施。
  - update: 2026-01-12 11:15 JST ファイル単位の実装スケッチ追記に着手。検証: 未実施。
  - update: 2026-01-12 11:30 JST 共通設計にファイル単位の実装スケッチを追加し、shape/route 側に固有ファイル補足を追記。検証: 未実施。
  - update: 2026-01-12 11:40 JST vt-orchestrator の runStage1 命名を runFetch に統一する作業に着手。検証: 未実施。
  - update: 2026-01-12 11:45 JST vt-orchestrator の runFetch 命名をドキュメントへ反映。検証: 未実施。
  - update: 2026-01-12 12:00 JST stage1/transform 責務の明確化、route band3 条件、sourceKey、tile coverage/index 仕様の反映に着手。検証: 未実施。
  - update: 2026-01-12 12:20 JST plugin側fetch/transform責務と route band3 条件/route sourceKey/coverage-index仕様を反映。検証: 未実施。
  - update: 2026-01-12 12:35 JST fetchDispatcher のI/Fと plugin接続点の明文化に着手。検証: 未実施。
  - update: 2026-01-12 12:45 JST fetchDispatcher のI/F（FetchContext/FetchResult/Dispatcher）を追記し、shape/route 側の接続点を明記。検証: 未実施。
  - update: 2026-01-12 13:00 JST route の band3 判定手順と依存データの具体化に着手。検証: 未実施。
  - update: 2026-01-12 13:10 JST route の band3 判定手順（入力/手順/出力）を追記し、ObsolateBuildConfig に保存する方針を明記。検証: 未実施。
  - update: 2026-01-12 13:20 JST route band3 判定を shape 依存のみに修正する作業に着手。検証: 未実施。
  - update: 2026-01-12 13:25 JST route band3 判定を shape band3 のみに変更し、意図（タイル跨ぎの LineString 抽出一致）を注記。検証: 未実施。
  - update: 2026-01-12 13:40 JST route transform のタイル跨ぎ LineString 仕様を明文化する作業に着手。検証: 未実施。
  - update: 2026-01-12 13:45 JST route transform にタイル跨ぎ LineString 仕様を追記し、band3 条件の説明を shape 依存に統一。検証: 未実施。
  - update: 2026-01-12 14:00 JST band3 条件と plugin/orchestrator 責務の整合整理に着手。検証: 未実施。
  - update: 2026-01-12 14:10 JST band3 条件を shape/route で分離し、plugin→orchestrator 責務を明記。検証: 未実施。
  - update: 2026-01-12 14:20 JST runFetch の位置付け整理に着手。検証: 未実施。
  - update: 2026-01-12 14:30 JST runFetch を削除し、plugin→orchestrator のタスク投入に整理。検証: 未実施。
  - update: 2026-01-12 14:40 JST taskQueue の payload 仕様明確化に着手。検証: 未実施。
  - update: 2026-01-12 14:50 JST transform/vt タスク payload を plugin→taskQueue 前提で明記し、stage1 は plugin 内完結と注記。検証: 未実施。
  - update: 2026-01-12 15:00 JST マージ後の齟齬を整理し、plugin→orchestrator 責務と stage1 タスク表記を整合。検証: 未実施。
  - update: 2026-01-12 15:10 JST taskQueue の役割（Dexie 永続化/メタデータ/進捗通知）を補強する作業に着手。検証: 未実施。
  - update: 2026-01-12 15:15 JST taskQueue の Dexie 永続化と進捗/エラー通知の責務を明記。検証: 未実施。
  - update: 2026-01-12 15:30 JST stage1 を taskQueue 管理対象に戻す修正に着手。検証: 未実施。
  - update: 2026-01-12 15:40 JST fetch タスクを taskQueue 管理対象にし、payload と責務表記を整合。検証: 未実施。
  - update: 2026-01-12 15:50 JST taskQueue の状態遷移と進捗イベント仕様の明文化に着手。検証: 未実施。
  - update: 2026-01-12 16:00 JST taskQueue の状態遷移と進捗イベント最小フォーマットを追記。検証: 未実施。
  - update: 2026-01-12 16:10 JST taskQueue に queued→running→skipped を追加する作業に着手。検証: 未実施。
  - update: 2026-01-12 16:15 JST taskQueue の状態遷移に skipped を追加し、イベントstatusと条件例を明記。検証: 未実施。
  - update: 2026-01-12 16:25 JST reused 状態の追加と skipped 条件の分離に着手。検証: 未実施。
  - update: 2026-01-12 16:30 JST reused 状態を追加し、既存成果は reused に分類。skipped の条件を分離。検証: 未実施。
  - update: 2026-01-12 16:40 JST reused/skipped の後段タスク・リソース提供の差を明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 16:45 JST reused は後段タスク/リソース提供、skipped は提供なしと明記。検証: 未実施。
  - update: 2026-01-12 16:55 JST reused/skipped の定義をキャッシュ/無提供の意味に沿って更新する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:00 JST reused はキャッシュ等で成功時同等の成果を提供、skipped は提供なしと明記。検証: 未実施。
  - update: 2026-01-12 17:05 JST skipped を「提供なし・エラー報告不要」と明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:10 JST skipped は提供なしだがエラー報告不要と明記。検証: 未実施。
  - update: 2026-01-12 17:20 JST fetch 成功時のキャッシュと reused 処理の連携を明記する作業に着手。検証: 未実施。
  - update: 2026-01-12 17:25 JST fetch 成功時に smartFetch キャッシュし、以降は reused とする仕様を追記。検証: 未実施。
  - update: 2026-01-12 17:35 JST route-fetch の waypoints 計算結果のキャッシュと reused 扱いの追記に着手。検証: 未実施。
  - update: 2026-01-12 17:40 JST route-fetch の waypoints（大圏航路/ searoute-jp）キャッシュと reused 扱いを追記。検証: 未実施。
  - update: 2026-01-12 18:00 JST taskId/キャッシュキー/カバレッジ/リトライ仕様の詳細化に着手。検証: 未実施。
  - update: 2026-01-12 18:15 JST taskId 規則・キャッシュキー・tile coverage/index・リトライ方針を批判的検討と新仕様で追記。検証: 未実施。

2117) feat/app/tree-node-info-panel-build-flow (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/app/tree-node-info-panel-build-flow
- 依存: なし
- ExecPlan: plans/tree-node-info-panel-build-flow-execplan.md
- 受け入れ基準: TreeNodeInfoPanel に Build ボタンが追加され、build/download 対象ノードで自動ビルド/自動ダウンロードが実行される／folder ノードで子孫・先祖の自動ビルドが順次実行される／完了後に元の pageNodeId に戻る／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`, `app/src/router/pages/tree/console/useTreeNodeInfoPanel.ts`, `app/src/router/routes/tree/PluginDialogRoute.tsx`, `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx`, `packages/ui/tabular-extract/src/components/TabularDataImport.tsx`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、Build ボタン/自動ビルド導線を元に戻す
- チェックリスト:
  - build/download 対象ノードの判定と遷移 URL を整理する
  - ?build=1 で自動ビルド/ダウンロードが走る導線を実装する
  - folder のビルドシーケンス遷移と復帰を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:40 JST TreeNodeInfoPanel の Build ボタンと自動ビルド導線の設計に着手。
  - update: 2026-01-06 07:53 JST ExecPlan を作成（plans/tree-node-info-panel-build-flow-execplan.md）。検証: 未実施。
  - update: 2026-01-11 17:35 JST Build ボタンのアイコンを Construction に統一する指示を反映する作業に着手。検証: 未実施。
  - update: 2026-01-11 17:45 JST Build ボタンのアイコン更新、auto build/return と auto download を実装。検証: 未実施。

2116) fix/app/trash-restore-refresh (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-restore-refresh
- 依存: なし
- 受け入れ基準: ゴミ箱復元時に強制リロード相当の初期化が走らず、TreeSubscriptionAPI の更新で画面が反映される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/useTrashDialog.ts` と復元後の画面遷移処理（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、復元後の挙動を元に戻す
- チェックリスト:
  - Trash 復元後のリロード経路を特定する
  - TreeSubscriptionAPI の更新だけで済むよう調整する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:20 JST Trash 復元時の強制リロード挙動の調査に着手。
  - update: 2026-01-11 16:25 JST restore 後の closeDialog から reload 指定を外し、TreeSubscriptionAPI 更新に委ねるよう修正。検証: 未実施。

2115) fix/app/trash-restore-originalname (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-restore-originalname
- 依存: なし
- 受け入れ基準: ゴミ箱から復元したノードの `originalName` が復旧される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/**` と復元処理周辺（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、復元前の挙動へ戻す
- チェックリスト:
  - originalName が復元されない経路を特定する
  - 復元処理で originalName を反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:00 JST Trash 復元時の originalName 未復旧の調査に着手。
  - update: 2026-01-11 16:10 JST restoreFromTrash で metadata.name を originalName 由来の値に復旧するよう修正。検証: 未実施。

2114) fix/app/trash-dialog-useeffect-loop (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/trash-dialog-useeffect-loop
- 依存: なし
- 受け入れ基準: TrashDialog の useEffect が無限更新にならない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/trash/TrashDialog.tsx`（必要に応じて関連 hook）
- ロールバック手順: `app/src/router/pages/tree/trash/TrashDialog.tsx` の差分を revert し、useEffect 修正前に戻す
- チェックリスト:
  - TrashDialog の useEffect を特定し依存と state 更新の関係を確認する
  - 無限更新の原因を整理し修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 15:40 JST TrashDialog の useEffect 無限更新警告の調査に着手。
  - update: 2026-01-06 07:03 JST useTrashFrameState の正規化処理で同値更新を抑止し、useEffect の再実行ループを回避。検証: 未実施。

2113) fix/runtime-worker/stageprocessing-typecheck (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/runtime-worker/stageprocessing-typecheck
- 依存: なし
- 受け入れ基準: `@hierarchidb/runtime-worker` の typecheck で StageProcessingService の TS2345 が解消する／VectorTileRecord と VectorTileRow の型整合が取れる／挙動は変更しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/StageProcessingService.ts`（必要に応じて型定義）
- ロールバック手順: `packages/runtime-worker/src/services/StageProcessingService.ts` の差分を revert し、型修正前に戻す
- チェックリスト:
  - StageProcessingService の vector tile 取り扱い型を確認する
  - TS2345 を解消するための型修正を行う
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 15:20 JST runtime-worker の StageProcessingService typecheck 修正に着手。
  - update: 2026-01-11 15:30 JST shape vector tile の bulkUpsert で必須フィールドを補完し、storeTiles の contentType を型に合わせて統一。検証: 未実施。

2112) fix/shape/step5-clear-stage-cache-counters (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/step5-clear-stage-cache-counters
- 依存: なし
- 受け入れ基準: Step4 で extract1/extract2 のキャッシュ削除を実行した後、Step5 のタスク一覧と集計が `0/0` `0%` `No tasks yet.` 表示になる／既存の進捗・タスク集計に回帰がない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `plugins/shape-plugin/src/services/batch/**`（調査後に絞り込み）
- ロールバック手順: Step4/Step5 周辺の差分を revert し、従来の表示へ戻す
- チェックリスト:
  - Step4 のキャッシュ削除後に Step5 のタスク集計が残る原因を特定する
  - Step5 のタスク集計/一覧を 0 に更新する処理を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 14:20 JST Step4 のキャッシュ削除後に Step5 のタスク集計が残る問題の調査に着手。
  - update: 2026-01-11 14:30 JST Step4 の削除処理で extract1/2 のローカルタスク表示を消去し、Step5 側で taskSummary を再評価して 0 件時にリセットする対応を追加。検証: 未実施。
  - update: 2026-01-11 14:40 JST Step4 の削除ボタン判定に extract1/extract2 タスク数を追加し、停止中でタスクが残っている場合に削除可能とする対応を追加。検証: 未実施。

2111) fix/app/geojson-vt-resolve (P1) — 完了 (2026-01-06)
- ブランチ名: fix/app/geojson-vt-resolve
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で geojson-vt の解決エラーが発生しない／TASKS.md に運用ログを記載する／ロールバック手順を明記する
- 影響範囲: `app/vite.config.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`（調査後に絞り込み）
- ロールバック手順: 追加した依存または build 設定の差分を revert し、従来のビルド設定に戻す
- チェックリスト:
  - build 時に geojson-vt が解決できない原因を確認する
  - build を通すための修正を実施する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-06 00:26 JST geojson-vt の build 解決エラー対応に着手。
  - done: 2026-01-06 10:01 JST shape-plugin に geojson-vt 依存を追加し、lockfile を更新。検証: 未実施。

2111) fix/shape/step5-task-titles (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/step5-task-titles
- 依存: なし
- 受け入れ基準: ダウンロードタスクは `JPN/1` のまま／一次抽出タスクは `JPN/1 | Japan/Tokyo` 形式で英語国名/地域名を付与／二次抽出タスクは `JPN/1 | Japan/Tokyo | z4-6` のようにズーム範囲を表示／既存の並び順や処理内容は維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/**`, `plugins/shape-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: タスクタイトル生成の差分を revert し、従来の `JPN/1` 表記へ戻す
- チェックリスト:
  - タスクタイトル生成の実装箇所を特定する
  - 一次抽出/二次抽出のタイトル拡張を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 07:10 JST Step5 タスクタイトルの拡張対応に着手。
  - update: 2026-01-11 15:35 JST タスク表記を「JPN/1 | Japan/Tokyo | z4-6」形式へ変更する方針で合意。
  - update: 2026-01-11 15:45 JST extract1/extract2 のタイトル生成を「JPN/1 | Japan/Tokyo | z4-6」形式へ更新。検証: 未実施。

2113) fix/ui-map/map-preview-basemap-and-missing-layer-warning (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/ui-map/map-preview-basemap-and-missing-layer-warning
- 依存: なし
- 受け入れ基準: `/map` のデフォルト basemap が Satellite ではなく Terrain になる／`/map` のプレビューで対象レイヤが未生成の場合に内部エラーではなく「まだビルドされていないノードがあります」系の警告ダイアログを毎回表示する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/routes/map/**`, `packages/ui/map/src/**`（調査後に絞り込み）
- ロールバック手順: `/map` のデフォルト style と警告ダイアログの差分を revert し、従来の表示に戻す
- チェックリスト:
  - `/map` のデフォルト basemap を Terrain へ変更する
  - 未生成レイヤ検知時の警告ダイアログを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:05 JST /map のデフォルト basemap と未生成レイヤ警告の対応に着手。
  - update: 2026-01-11 16:20 JST /map のデフォルト style を Terrain に変更し、未生成レイヤ検知時に警告ダイアログを表示する処理を追加。検証: 未実施。

2114) investigate/shape/step4-filter-config-usage (P2) — 進行中 (2026-01-11)
- ブランチ名: investigate/shape/step4-filter-config-usage
- 依存: なし
- 受け入れ基準: Step4 の面積フィルター/最小頂点数/最小面積/クイック除外しきい値/シンプル形状頂点しきい値/細長形状補正係数が実処理で参照されているかを確認し、参照箇所または未使用を報告する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/features/gis-sdk/src/**`, `packages/runtime-worker/src/**`（調査結果に応じて）
- ロールバック手順: 調査のみのため不要
- チェックリスト:
  - Step4 UI で設定される項目の保存先を確認する
  - ワーカー/処理パイプラインでの参照有無を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:35 JST Step4 のフィルタ設定が実処理で参照されているかの調査に着手。
  - done: 2026-01-11 16:45 JST Step4 のフィルタ設定は batchConfig へ保存されるが、現行の shape-vt パイプラインでは参照されていないことを確認。報告のみ、変更なし。

2110) feat/ui-map/attribution-badge (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/ui-map/attribution-badge
- 依存: なし
- ExecPlan: plans/ui-map-attribution-badge-execplan.md
- 受け入れ基準: shape/location/route で選択可能なデータソースの attribution を網羅できる／MapLibre 標準の Attribution/License バッジで表示される／Step6 プレビューに限定せず `@hierarchidb/ui-map` の標準機能として `/map` 等で再利用できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/**`, `plugins/location-plugin/src/ui/**`, `plugins/route-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: 追加した attribution 表示とデータソース定義の差分を revert し、従来の地図表示に戻す
- チェックリスト:
  - ui-map に attribution 表示の共通 API を追加する
  - shape/location/route のデータソース attribution 定義を整理する
  - Step6 と /map で attribution が表示されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:30 JST attribution 表示の共通実装とデータソース網羅の設計に着手。
  - update: 2026-01-11 06:00 JST ExecPlan を作成（plans/ui-map-attribution-badge-execplan.md）。
  - update: 2026-01-11 06:55 JST ui-map に attribution 制御とフォーマッタを追加し、shape/location/route のプレビューと /map で attributionItems を配線。location は選択肢に合わせて alias/fallback で対応。検証: 未実施。

2109) feat/shape/geojson-vt-index-reuse (P1) — 進行中 (2026-01-11)
- ブランチ名: feat/shape/geojson-vt-index-reuse
- 依存: なし
- 受け入れ基準: extract2 で geojson-vt の index を生成して IndexedDB に保存できる／vectortile ステージで保存済み index を復元して再利用できる／既存の per-tile index 生成が抑制される／設計と手順を doc に整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/**`, `packages/features/gis-sdk/src/**`, `plugins/shape-plugin/src/services/**`（調査後に絞り込み）
- ロールバック手順: 追加した index 保存/復元の処理を revert し、従来の per-tile index 生成へ戻す
- チェックリスト:
  - idb-geojson-vt-test.html の復元手順をコードに反映する
  - extract2 で geojson-vt index を生成して IndexedDB に保存する
  - vectortile で index を復元し geojson-vt 生成を再利用する
  - 既存の index 生成経路が重複しないよう制御する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:20 JST extract2 で geojson-vt index を保存し vectortile で再利用する対応に着手。
  - update: 2026-01-11 05:30 JST extract2 入力に vectorTiles 設定を追加し、EphemeralShapeDB に geojson-vt index の保存テーブル/APIを追加。extract2 で index 保存、vectortile で復元して storeTiles に保存する経路を実装。検証: 未実施。

2103) fix/shape/step5-pause-flapping (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-pause-flapping
- 依存: なし
- 受け入れ基準: Step5 のタイル生成で一時停止が勝手に再開/再停止しない／再現条件と原因・発生範囲を説明する／修正方法と適用範囲を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/**`, `packages/runtime-worker/src/**`, `packages/plugin-service-sdk/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、一時停止ロジックを元に戻す
- チェックリスト:
  - 再現条件とログを確認する
  - 一時停止/再開の状態遷移を特定する
  - 安定化の修正を実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:15 JST Step5 タイル生成の一時停止フラッピング調査に着手。
  - done: 2026-01-05 21:21 JST progress phase と session status の不一致で paused が running に上書きされる問題を修正。影響は shape-plugin の progress status 判定のみ。検証: 未実施。

2104) fix/shape/step5-status-phase-flap (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-status-phase-flap
- 依存: なし
- 受け入れ基準: Step5 のタイル生成で completed/running の揺れが発生しない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の status 判定へ戻す
- チェックリスト:
  - 進捗 phase と session status の優先順位を整理する
  - Step5 で status が揺れないように修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:24 JST Step5 の completed/running フラップ調査に着手。
  - done: 2026-01-05 21:25 JST progress phase より session status を優先するように修正し、completed/running の揺れを抑止。検証: 未実施。

2105) fix/shape/step5-zoom-range-block (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-zoom-range-block
- 依存: なし
- 受け入れ基準: Step5 のビルド開始で「Zoom range changed...」が誤検知されず開始できる／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/stage/useBatchSessionActions.ts`, `plugins/shape-plugin/src/worker/api.ts`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、ズーム範囲判定を元に戻す
- チェックリスト:
  - Zoom range mismatch の判定条件を確認する
  - Start/Resume の分岐とステータス更新を整理する
  - ビルド開始のブロックを解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:39 JST Step5 のズーム範囲警告で開始できない問題の調査に着手。
  - done: 2026-01-05 22:40 JST ズーム範囲不一致時は resume をスキップして新規開始へ進むよう修正。検証: 未実施。

2106) fix/shape/step5-next-disabled (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-next-disabled
- 依存: なし
- 受け入れ基準: Step5 でタイル/メタデータが生成されている場合に valid となり「次へ」が有効化される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、Step5 の valid 判定を元に戻す
- チェックリスト:
  - Step5 の valid 判定条件と「次へ」制御を確認する
  - 生成済みタイル/メタデータの検知経路を整理する
  - 「次へ」無効化の原因を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:45 JST Step5 の「次へ」無効化調査に着手。
  - done: 2026-01-05 22:46 JST Step データに nodeId を常時付与し、プレビュー可否判定が DB 検索に到達できるよう修正。検証: 未実施。

2107) fix/shape/step6-vector-tile-missing (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step6-vector-tile-missing
- 依存: なし
- 受け入れ基準: Step6 で「ベクトルタイルがまだありません」が出ずプレビューが表示される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`, `packages/runtime-worker/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、従来のプレビュー判定へ戻す
- チェックリスト:
  - ベクトルタイル保存・参照の経路を確認する
  - Step6 の「タイルなし」判定条件を確認する
  - 不整合の原因を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 22:50 JST Step6 のベクトルタイル未検知問題の調査に着手。
  - done: 2026-01-05 22:55 JST stage worker 起動時に shape の vector tile store を登録し、タイル保存先が欠ける問題を修正。検証: 未実施。

2108) fix/shape/step5-next-during-build (P1) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step5-next-during-build
- 依存: なし
- 受け入れ基準: Step5 のビルド進行中でも「次へ」が有効化される／Step6 で進行中のタイル生成が待機/表示される／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps-provider.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、Step5/Step6 の判定を元に戻す
- チェックリスト:
  - Step5 の valid 判定にビルド中を含める
  - Step6 の canProceed 判定にビルド中を含める
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 23:01 JST Step5 のビルド中「次へ」無効化の調査に着手。
  - done: 2026-01-05 23:01 JST processing/paused を Step5/Step6 の判定に含め、ビルド中も「次へ」を許可。検証: 未実施。

2102) fix/shape/step4-cache-labels (P2) — 完了 (2026-01-05)
- ブランチ名: fix/shape/step4-cache-labels
- 依存: なし
- 受け入れ基準: shape-plugin Step4 の「ステージ1キャッシュ/ステージ2キャッシュ」を「一次抽出キャッシュ/二次抽出キャッシュ」に置換する／英語表記を extract1 cache / extract2 cache に揃える／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/**`（該当箇所）
- ロールバック手順: 該当ファイルの文言差分を revert し、従来の表記へ戻す
- チェックリスト:
  - Step4 の日本語表記を更新する
  - Step4 の英語表記を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 21:11 JST Step4 のキャッシュ表記変更に着手。
  - done: 2026-01-05 21:12 JST Step4 のキャッシュ表記を一次/二次抽出に更新し、英語表記を extract1/extract2 cache に統一。検証: 未実施。

2101) investigate/shape/vectortile-hotspots-and-wasm (P1) — 進行中 (2026-01-11)
- ブランチ名: investigate/shape/vectortile-hotspots-and-wasm
- 依存: なし
- 受け入れ基準: タイル生成処理の重い区間を計測ログで特定する／最適化余地と候補を列挙する／WASM 化の適用候補と可否を整理する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、計測ログ追加前に戻す
- チェックリスト:
  - タイル生成のボトルネックを計測ログで可視化する
  - 最適化候補を整理する
  - WASM 化の適用可能箇所を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:10 JST タイル生成のボトルネック調査に着手。
  - update: 2026-01-11 03:25 JST runtime-worker と gis-sdk にタイル生成の区間別計測ログを追加。検証: 未実施。
  - update: 2026-01-11 03:45 JST 計測ログから tiles built（tile 走査/エンコード）と geojson-vt index が主要コストで、read/decode/store は軽微と判明。WASM 置換は geojson-vt/vt-pbf がJS実装のため難易度高く、まずはタイル候補削減/ズーム範囲/入力削減で最適化検討が必要と整理。検証: 未実施。
  - update: 2026-01-11 04:05 JST extract2 の tileId relations を実形状交差で絞る独立ExecPlanを作成。`docs/shape-tileid-intersection-execplan.md` を追加。検証: 未実施。

2100) fix/shape/download-stall-chunk-store-response (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape/download-stall-chunk-store-response
- 依存: なし
- 受け入れ基準: download ステージで chunk-store 経由取得が停止しない／URL 取得の HEAD/GET と Dexie キャッシュの復元が期待通りに動作する／必要なら不整合の原因を説明し修正する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/datasources/*.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、chunk-store 関連の変更を元に戻す
- チェックリスト:
  - download ステージの取得経路で chunk-store の利用有無を確認する
  - HEAD/GET と Dexie 読み出しの挙動を確認する
  - 停止の原因を特定し修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:10 JST chunk-store と download 停止の関係調査に着手。
  - done: 2026-01-11 02:25 JST download タスクに timeout signal を追加し、chunk-store 経由の fetch がハングした際に abort→stale キャッシュへフォールバックできるよう調整。検証: 未実施。
  - update: 2026-01-11 02:40 JST chunk-store のキャッシュ整合性チェックを追加し、download タスクの段階ログを追加。検証: 未実施。
  - update: 2026-01-11 02:55 JST worker での CompressionStream を無効化し、chunk-store 書き込み前後のログを追加。検証: 未実施。
  - update: 2026-01-11 03:15 JST download バッファの gzip 圧縮を無効化し、保存は非圧縮で統一。検証: 未実施。

2101) fix/shape/step5-vectortile-sort-title-parse (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step5-vectortile-sort-title-parse
- 依存: なし
- 受け入れ基準: Step5 の vectortile タスク一覧が z/x/y 数値昇順で表示される／タスクタイトルの z/x/y 表記から並び順が決まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、現行の並び順へ戻す
- チェックリスト:
  - タイトル表記から z/x/y を抽出してソートする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:20 JST vectortile タスクの並び順補正に着手。
  - update: 2026-01-11 03:10 JST Step5 の vectortile 並び順をタイトル由来の z/x/y で再調整する作業に着手。
  - done: 2026-01-11 03:20 JST vectortile タスクのタイトル表記から z/x/y を抽出して昇順ソートするよう統一。検証: 未実施。

2102) fix/shape/step4-zoom-config-card (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-zoom-config-card
- 依存: なし
- 受け入れ基準: Stage4 のズーム範囲/分割数/区切りが単一カードに統合される／挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - ズーム範囲/分割数/区切りを単一カードに統合する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:30 JST Step4 のズーム設定を単一カードへ統合する作業に着手。
  - done: 2026-01-11 03:40 JST ズーム範囲/分割数/区切りを単一カードに統合しレイアウトを調整。検証: 未実施。

2103) fix/shape/step4-tile-margin-layout (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-tile-margin-layout
- 依存: なし
- 受け入れ基準: タイルマージンがズームカードの下に移設される／タイルマージン/拡張係数/拡張マージンが横並び3列になる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - タイルマージンの位置をズームカード下へ移動する
  - 3列レイアウトへ揃える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 03:50 JST タイルマージンの配置と3列レイアウトの調整に着手。
  - done: 2026-01-11 04:00 JST タイルマージンをズームカード下へ移設し、マージン/拡張係数/拡張マージンを3列で配置。検証: 未実施。

2104) fix/shape/step4-zoom-card-columns (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step4-zoom-card-columns
- 依存: なし
- 受け入れ基準: ズームカード内のズーム範囲/分割数/区切りが横並び3列になる／挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: 上記ファイルの差分を revert して現行レイアウトへ戻す
- チェックリスト:
  - ズームカード内の3項目を横並びにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:10 JST ズームカード内の3項目を横並びにする作業に着手。
  - done: 2026-01-11 04:15 JST ズームカード内を3列レイアウトに変更。検証: 未実施。

2105) investigate/shape/step5-next-disabled (P2) — 完了 (2026-01-11)
- ブランチ名: investigate/shape/step5-next-disabled
- 依存: なし
- 受け入れ基準: Step5 の Next が enabled なのに押せない要因を特定し説明する／必要であれば修正方針を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/*`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`（必要に応じて）
- ロールバック手順: 変更があれば差分を revert して現行挙動へ戻す
- チェックリスト:
  - Step5 の Next 判定・クリック処理の経路を確認する
  - Stepper の遷移経路との差分を特定する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:25 JST Step5 の Next が押せない事象の原因調査に着手。
  - done: 2026-01-11 04:35 JST Next は onStepNavigate→handleNavigation を通るが、runWithPending が in-flight を検知すると無視されるため、pendingAction が残っていると「見た目は有効だが反応なし」になり得る点を確認。Step6 直行は direct ナビゲーション経路で同じ onStepNavigate を使うため、pendingAction/ensureNoConflict/updateLocalDraft のブロックが主な候補。検証: 未実施。

2106) fix/shape/step3-auth-warning-suppress (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-auth-warning-suppress
- 依存: なし
- 受け入れ基準: shape Step3 の認証が必要警告がUIに表示されない／内部処理やログに影響しない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui-auth/src/AuthRequiredDialog.tsx`（必要に応じて）
- ロールバック手順: 表示抑制の差分を revert して現行表示へ戻す
- チェックリスト:
  - shape Step3 の警告表示を抑制する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 04:45 JST Step3 の認証警告表示の抑制に着手。
  - update: 2026-01-11 05:05 JST shape の AUTH_REQUIRED を UI 表示せず、キャンセル通知も返さないよう修正。検証: 未実施。
  - update: 2026-01-11 05:15 JST Step3 のメタデータ取得は auth 無効のネットワークポートに変更し、AUTH_REQUIRED を発生させない形へ調整。検証: 未実施。

2107) fix/app/ui-search-field-dep (P1) — 完了 (2026-01-11)
- ブランチ名: fix/app/ui-search-field-dep
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で ui-search-field が UNLOADABLE_DEPENDENCY にならない／依存が package.json に明示される／TASKS.md に運用ログを記載する
- 影響範囲: `app/package.json`
- ロールバック手順: 依存追加差分を revert する
- チェックリスト:
  - app/package.json に ui-search-field を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:25 JST app の ui-search-field 依存追加に着手。
  - done: 2026-01-11 05:27 JST app に @hierarchidb/ui-search-field を追加して UNLOADABLE_DEPENDENCY を回避。検証: 未実施。

2108) fix/ui-treeconsole-treetable/column-id-accessor (P1) — 完了 (2026-01-11)
- ブランチ名: fix/ui-treeconsole-treetable/column-id-accessor
- 依存: なし
- 受け入れ基準: TreeTableCore の accessorKey 参照がなくなり typecheck が通る／ColumnDef の型に沿った判定になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/treetable/src/components/TreeTableCore.tsx`
- ロールバック手順: 参照変更の差分を revert する
- チェックリスト:
  - accessorKey 参照を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:40 JST TreeTableCore の accessorKey 参照修正に着手。
  - done: 2026-01-11 05:42 JST column.id のみを使う形へ変更し accessorKey 参照を削除。検証: 未実施。

2109) fix/shape-plugin/typecheck-missing-vt-pbf (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape-plugin/typecheck-missing-vt-pbf
- 依存: なし
- 受け入れ基準: shape-plugin の typecheck で vt-pbf と型エラーが解消する／依存追加と型修正が最小差分で入る／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/package.json`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: 上記ファイルの差分を revert して現行挙動へ戻す
- チェックリスト:
  - vt-pbf 依存を追加する
  - GeoJSONVT / tileZ などの型エラーを修正する
  - taskType 参照を削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 05:55 JST shape-plugin typecheck の vt-pbf/型エラー修正に着手。
  - done: 2026-01-11 06:05 JST vt-pbf 依存を追加し、GeoJSONVT/タイル座標/taskType の型エラーを修正。検証: 未実施。
  - update: 2026-01-11 06:10 JST geojson-vt Tile 型を明示して vt-pbf 変換の型エラーを解消。検証: 未実施。
  - update: 2026-01-11 06:15 JST tile null を明示的に除外して spread の型エラーを解消。検証: 未実施。

2110) feat/shape-plugin/step5-i18n (P2) — 完了 (2026-01-11)
- ブランチ名: feat/shape-plugin/step5-i18n
- 依存: なし
- 受け入れ基準: Step5 のラベル/全体進捗カードの文言が i18n され日本語訳が入る／英語は既存文言を維持／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/locales/ja.json`, `plugins/shape-plugin/src/ui/locales/en.json`（必要に応じて）
- ロールバック手順: 翻訳追加の差分を revert して現行表示へ戻す
- チェックリスト:
  - Step5 の文言キーを確認して翻訳を追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:25 JST Step5 の i18n 文言追加に着手。
  - done: 2026-01-11 06:30 JST Step5 の Build/Stage/Task ラベルを i18n 化し日本語訳を追加。検証: 未実施。

2111) fix/shape-plugin/step3-geoboundaries-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape-plugin/step3-geoboundaries-auth
- 依存: なし
- 受け入れ基準: Step3 の geoboundaries メタデータ取得が 401 で失敗しない／shape の認証要求が UI を出さずに解決される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `app/src/contexts/AuthRequiredDialogHost.tsx`
- ロールバック手順: 依存箇所の差分を revert して現行挙動へ戻す
- チェックリスト:
  - geoboundaries/gadm のネットワークポートを auth 有効に戻す
  - shape の AUTH_REQUIRED をストレージトークンで即時解決する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:40 JST Step3 の geoboundaries 401 問題修正に着手。
  - done: 2026-01-11 06:45 JST shape の AUTH_REQUIRED を保存済みトークンで自動解決し、メタデータ取得の auth を復帰。検証: 未実施。

2112) fix/shape-plugin/step3-auth-dialog-flow (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/shape-plugin/step3-auth-dialog-flow
- 依存: なし
- 受け入れ基準: geoboundaries の 401 で AuthRequiredDialog が開き、認証完了後に取得が再開する／401ループが解消する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/contexts/AuthRequiredDialogHost.tsx`, `packages/ui/auth/src/components/AuthRequiredDialog.tsx`, `packages/features/auth-recovery/src/AuthService.ts`, `packages/features/download/src/smartFetch.ts`, `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`
- ロールバック手順: 自動解決削除の差分を revert して前の挙動へ戻す
- チェックリスト:
  - AUTH_REQUIRED の自動解決を削除する
  - 認証ダイアログが開くことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 06:55 JST Step3 の auth ダイアログフロー復旧に着手。
  - update: 2026-01-11 16:20 JST 401ループとAuthRequiredDialogの連携不全を調査し、ダイアログ表示/復帰フローを再整備予定。検証: 未実施。
  - update: 2026-01-11 16:45 JST AuthService の認証後レスポンス再利用と AuthRequiredDialog のログ/挙動を修正。検証: 未実施。
  - update: 2026-01-11 16:55 JST AuthService の res 再宣言エラーを修正。検証: 未実施。
  - update: 2026-01-11 17:15 JST AuthRequiredDialog の自動セッション使用を停止し、refreshToken 検証を追加。Step3 の dataSource 未設定警告をロード前は抑止。検証: 未実施。
  - update: 2026-01-11 17:35 JST Step3 の dataSource 未設定判定を batchConfig 準備後に限定し、Step2 への誤リダイレクトを抑止。検証: 未実施。
  - update: 2026-01-11 17:55 JST AuthRequiredDialog から「Use Current Session」ボタンを撤去。検証: 未実施。
  - update: 2026-01-11 18:15 JST Cancel (Back to Step 2) を useDialogUrlSync で遷移させ、認証済み時の警告理由を表示。検証: 未実施。
  - update: 2026-01-11 18:35 JST AUTH_REQUIRED の errorCode/source を実状に合わせて分岐し、UIで有効トークンなら自動解決。検証: 未実施。

2113) chore/docs/agents-no-fallback-rule (P2) — 進行中 (2026-01-11)
- ブランチ名: chore/docs/agents-no-fallback-rule
- 依存: なし
- 受け入れ基準: AGENTS.md に「指示がない限りフォールバック禁止・型で強制」方針を明記する／TASKS.md に運用ログを記載する
- 影響範囲: `AGENTS.md`
- ロールバック手順: AGENTS.md の追記差分を revert して元に戻す
- チェックリスト:
  - フォールバック禁止方針を明文化する
  - 型の厳格利用を明記する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 16:20 JST AGENTS.md にフォールバック禁止方針の追記に着手。
  - done: 2026-01-11 16:45 JST AGENTS.md に型の厳格運用方針を追記。検証: 該当なし。

2100) fix/shape/step5-vectortile-task-sort (P2) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step5-vectortile-task-sort
- 依存: なし
- 受け入れ基準: Step5 の vectortile タスク一覧が z/x/y 数値昇順で表示される／他ステージの並びに影響しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、現行の並び順へ戻す
- チェックリスト:
  - vectortile タスクのメタデータに z/x/y を付与する
  - Step5 の表示で z/x/y 昇順にソートする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 02:00 JST Step5 の vectortile タスク並び順修正に着手。
  - done: 2026-01-11 02:06 JST vectortile タスクに z/x/y メタデータを付与し表示を昇順ソート。検証: 未実施。

2099) feat/download/smartfetch-inflight (P2) — 完了 (2026-01-11)
- ブランチ名: feat/download/smartfetch-inflight
- 依存: なし
- 受け入れ基準: smartFetch に in-flight 共有オプションを追加しGET/HEADのみ対象にする／既定キーは method+resolvedUrl+accept／キー生成を差し替え可能／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/download/src/smartFetch.ts`
- ロールバック手順: 上記ファイルの差分を revert し、in-flight 共有オプションを削除する
- チェックリスト:
  - in-flight オプション型を追加する
  - GET/HEAD のみ共有する処理を追加する
  - 既定キーと差し替えロジックを実装する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:40 JST smartFetch の in-flight 共有実装に着手。
  - done: 2026-01-11 01:50 JST in-flight 共有のオプション実装とキー差し替え対応を追加。検証: 未実施。

2098) fix/shape/step3-worker-metadata-reuse (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-worker-metadata-reuse
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得が worker 経由になり UI から直接URLアクセスしない／CountryAvailabilityResolver の取得結果を再利用する／重複アクセスが解消される／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`, `plugins/shape-plugin/src/ui/workers/countryAvailability.types.ts`, `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`
- ロールバック手順: 上記ファイルの差分を revert し、UI 直接取得に戻す
- チェックリスト:
  - worker API にメタデータ取得を追加する
  - UI hook を worker経由のメタデータ取得へ切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:15 JST Step3 のメタデータ取得を worker 経由に切り替える対応に着手。
  - done: 2026-01-11 01:26 JST worker 経由でメタデータ取得するよう変更し UI 直接アクセスを排除。検証: 未実施。

2097) fix/shape/step3-geoboundaries-proxy-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-geoboundaries-proxy-auth
- 依存: なし
- 受け入れ基準: geoBoundaries のメタデータ取得が CORS プロキシ経由で認証付きで成功する／401 が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来のネットワーク設定へ戻す
- チェックリスト:
  - geoBoundaries 取得で auth 無効化を撤廃する
  - CORS プロキシ経由の取得を有効化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:05 JST geoBoundaries 取得時の CORS プロキシ認証対応に着手。
  - done: 2026-01-11 01:07 JST geoBoundaries 取得で auth 無効化を撤廃し CORS プロキシ認証を通すよう修正。検証: 未実施。

2096) fix/shape/step3-disable-stale-metadata (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-disable-stale-metadata
- 依存: なし
- 受け入れ基準: Step3 のメタデータ取得で stale キャッシュフォールバックを行わない／ダミーキャッシュが使われない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、stale キャッシュ許可へ戻す
- チェックリスト:
  - geoboundaries metadata 取得で allowStale を false にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:50 JST Step3 メタデータの stale フォールバック排除に着手。
  - done: 2026-01-11 00:52 JST geoboundaries メタデータ取得で allowStale を無効化。検証: 未実施。

2095) refactor/util/dedupe-sleep (P2) — 完了 (2026-01-11)
- ブランチ名: refactor/util/dedupe-sleep
- 依存: なし
- 受け入れ基準: 指定ファイルの sleep 定義を共通ユーティリティへ集約し重複を解消する／各ファイルの動作は保持される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/util/src/sleep.ts`, `packages/util/src/index.ts`, `packages/tools/gen-iso3166-2/src/scraper.ts`, `packages/features/chunk-store/src/index.ts`, `packages/features/download/src/adapters/FetchNetworkPort.ts`, `packages/features/download/src/smartFetch.ts`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`
- ロールバック手順: 上記ファイルの差分を revert し、各ファイルのローカル sleep 定義を復元する
- チェックリスト:
  - 共通 sleep ユーティリティを追加する
  - 指定ファイルの sleep 定義を置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:35 JST sleep ユーティリティの重複解消に着手。
  - done: 2026-01-11 00:40 JST 共通 sleep を追加し各ファイルのローカル定義を置換。検証: 未実施。

2094) fix/shape/step3-gadm-cors-proxy-auth (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-gadm-cors-proxy-auth
- 依存: なし
- 受け入れ基準: GADM メタデータ取得が CORS プロキシ経由で成功する／401 が発生しない／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/metadata/metadataSources.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の FetchNetworkPort 設定に戻す
- チェックリスト:
  - GADM メタデータ取得で auth 無効化をやめる
  - CORS プロキシ経由の取得を有効化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:25 JST GADM 取得時の CORS プロキシ認証対応に着手。
  - done: 2026-01-11 00:27 JST GADM 取得で auth 無効化を撤廃し CORS プロキシ認証を通すよう修正。検証: 未実施。

2093) fix/shape/step3-remove-dummy-metadata-seed (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-remove-dummy-metadata-seed
- 依存: なし
- 受け入れ基準: Step3 のハードコード済みダミー国メタデータを削除する／シードによるサイレントフォールバックを排除する／データ不足時は明示的にエラーを返す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/seedStep3Cache.ts`, `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, `plugins/shape-plugin/src/common/mock/data.ts`
- ロールバック手順: 上記ファイルの差分を revert し、シードとダミーデータ定義を復元する
- チェックリスト:
  - Step3 のダミー国メタデータ定義を削除する
  - シード処理を排除しフォールバックを止める
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:15 JST Step3 ダミーメタデータ削除に着手。
  - done: 2026-01-11 00:20 JST ダミー国メタデータとシード処理を削除。検証: 未実施。

2092) fix/ui/tree-node-info-panel-close-root (P2) — 完了 (2026-01-11)
- ブランチ名: fix/ui/tree-node-info-panel-close-root
- 依存: なし
- 受け入れ基準: `/t/r` で×ボタンが表示されない／ルート以外は×ボタンが表示され親ノードへ遷移する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、従来の表示条件へ戻す
- チェックリスト:
  - ルート判定ロジックを修正し×ボタンを非表示にする
  - 親ノード遷移が維持されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:07 JST ルート表示時に×ボタンが残る不具合対応に着手。
  - done: 2026-01-11 00:10 JST ルート判定を追加し×ボタンを非表示化。検証: 未実施。

2091) fix/ui/tree-node-info-panel-close-parent (P2) — 完了 (2026-01-11)
- ブランチ名: fix/ui/tree-node-info-panel-close-parent
- 依存: なし
- 受け入れ基準: TreeNodeInfoPanel の×ボタンが親ノードへ遷移する／ルートノードでは×ボタンが非表示になる／`INVALID_OPERATION Unknown action: navigate` が出ない／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/router/pages/tree/console/TreeNodeInfoPanel.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、既存の×ボタン挙動に戻す
- チェックリスト:
  - ×ボタンの遷移を親ノードURLへ切り替える
  - ルートノード表示時は×ボタンを非表示にする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:00 JST TreeNodeInfoPanel の×ボタン遷移修正に着手。
  - done: 2026-01-11 00:05 JST 親ノード遷移とルート時の非表示を実装。検証: 未実施。

2090) fix/ui/dialog-backdrop-dismiss-icon (P2) — 完了 (2026-01-10)
- ブランチ名: fix/ui/dialog-backdrop-dismiss-icon
- 依存: なし
- 受け入れ基準: 「ダイアログ外クリックで閉じる」のアイコンを DisabledByDefault に変更する／表示のみ変更し挙動は維持する／TASKS.md に運用ログを記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: 上記ファイルの icon 差分を revert し、SettingsIcon に戻す
- チェックリスト:
  - 設定メニューの該当アイコンを DisabledByDefault に差し替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 23:55 JST ダイアログ外クリックのアイコン変更に着手。
  - done: 2026-01-10 23:56 JST SettingsMenu の表示アイコンを DisabledByDefault に更新。検証: 未実施。

2092) fix/shape/step3-auth-required-warning (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/step3-auth-required-warning
- 依存: なし
- 受け入れ基準: Step3 の auth-required 警告の発生源が特定される／認証ヘッダ未付与の有無が確認される／sessionId 表示の理由が整理され、不要なら除去される／必要な修正で警告が解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `packages/ui/auth/src/components/AuthRequiredDialog.tsx`
- ロールバック手順: 上記ファイルの差分を revert し、Step3 のネットワークが auth 有効に戻る／ログに sessionId が常時表示される状態へ戻す
- チェックリスト:
  - auth-required 発生経路とリクエスト元を特定する
  - 認証ヘッダ付与の有無を確認する
  - sessionId 表示の由来を確認する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:15 JST Step3 auth-required 警告の原因調査に着手。
  - done: 2026-01-11 00:25 JST Step3 の metadata 取得で auth を無効化し、AuthRequiredDialog のログから sessionId を省略。検証: 未実施。

2093) fix/chunk-store/fetch-singleflight-dedupe (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/chunk-store/fetch-singleflight-dedupe
- 依存: なし
- 受け入れ基準: 同一URL/キャッシュキーの取得で in-flight を合流させる／Strict Mode などの二重実行でも外部URLアクセスが1回に抑止される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`
- ロールバック手順: 上記ファイルの in-flight 合流ロジック差分を revert し、従来の直接フェッチ挙動に戻す
- チェックリスト:
  - in-flight 合流ロジックを追加する
  - getOrFetchForNode で並列取得を1回に抑止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 00:35 JST chunk-store の URL 取得重複を抑止するロック機構対応に着手。
  - blocked: 2026-01-11 00:50 JST ユーザー指示によりロック方式を中止し、singleflight 方式に切り替え。

2094) refactor/tools/gen-iso3166-2-node-browser-entry (P1) — 完了 (2026-01-11)
- ブランチ名: refactor/tools/gen-iso3166-2-node-browser-entry
- 依存: なし
- 受け入れ基準: Node専用スクレイパー/ストアとブラウザ用エントリが分離される／React側の参照が browser エントリに統一される／Node用途は node/cli/plugin エントリへ整理される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/tools/gen-iso3166-2/package.json`, `packages/tools/gen-iso3166-2/src/index.ts`, `packages/tools/gen-iso3166-2/src/node.ts`, `packages/tools/gen-iso3166-2/src/gen-iso3166-2.ts`, `packages/tools/gen-iso3166-2/src/store.browser.ts`, `plugins/shape-plugin/src/services/utils/iso3166.ts`, `plugins/location-plugin/src/services/LocationBatchManager.ts`, `plugins/location-plugin/src/services/__tests__/unit/LocationBatchManager.iso-normalization.unit.test.ts`, `app/vite.config.min.ts`
- ロールバック手順: 上記ファイルの差分を revert し、gen-iso3166-2 の単一エントリ運用へ戻す
- チェックリスト:
  - browser エントリと node エントリを分離する
  - browser 側の参照先を /browser に統一する
  - Node 側は /plugin・/node を使用する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:05 JST gen-iso3166-2 の Node/Browser エントリ分離に着手。
  - done: 2026-01-11 01:15 JST browser エントリを既定化し node エントリを追加、参照を整理。検証: 未実施。

2095) fix/shape/progress-event-mismatch (P1) — 完了 (2026-01-11)
- ブランチ名: fix/shape/progress-event-mismatch
- 依存: なし
- 受け入れ基準: UI が受け取る progress event が common-api の BatchProgressEvent 形式に統一される／progress の更新が subscription と polling で矛盾しない／タスク進行が UI に反映される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/worker/public.ts`
- ロールバック手順: 上記ファイルの差分を revert し、shape 独自イベントを返す挙動へ戻す
- チェックリスト:
  - worker の progress callback を common-api の BatchProgressEvent に合わせる
  - subscribeToProgress のイベントを変換せずに 전달する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 01:35 JST shape progress event の型不一致調査に着手。
  - done: 2026-01-11 01:55 JST worker progress を common-api の BatchProgressEvent に統一し、shape 独自イベント変換を廃止。検証: 未実施。

2091) refactor/ui/dialog-mode-single-type (P1) — 完了 (2026-01-05)
- ブランチ名: refactor/ui/dialog-mode-single-type
- 依存: なし
- 受け入れ基準: DialogUrlMode が廃止され DialogDisplayMode のみで統一される／URLのmode解釈が DialogDisplayMode に集約される／frame-state.ts の型エラーが解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`
- ロールバック手順: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts` の差分を revert し、mode 変換ロジックを元に戻す
- チェックリスト:
  - DialogUrlMode の利用箇所を整理する
  - DialogDisplayMode へ統一する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:11 JST mode 型の統一作業に着手。
  - done: 2026-01-05 16:12 JST DialogDisplayMode のみでURL modeを解釈するよう整理。

2090) fix/ui/dialog-mode-mapping-and-maximize (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/dialog-mode-mapping-and-maximize
- 依存: なし
- 受け入れ基準: dialogUrlMode と dialogDisplayMode の対応が整理される／`full`/`full-screen`/`maximize` の混乱が解消される／`/t/.../:mode/:step` で maximize を扱える／frame-state.ts の型エラーが解消される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`, `packages/plugin-base/src/hooks/useDialogUrlSync.ts`
- ロールバック手順: 上記ファイルの差分を revert し、従来の mode 解釈へ戻す
- チェックリスト:
  - mode の定義とマッピングを整理する
  - maximize のURL表現と表示モードを整合させる
  - frame-state の型エラーを解消する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:08 JST dialog mode の整理と型エラー修正に着手。
  - done: 2026-01-05 16:09 JST mode のURL表現を full/normal/maximize に統一し、frame-state の型を修正。

2089) fix/ui/dialog-step-mode-query-leak (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/dialog-step-mode-query-leak
- 依存: なし
- 受け入れ基準: ダイアログ遷移で `?step=&mode=` が付与されない／`/t/.../:action/:mode/:step` のパス形式のみになる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-base/src/hooks/useDialogUrlSync.ts`
- ロールバック手順: `packages/plugin-base/src/hooks/useDialogUrlSync.ts` の差分を revert し、クエリ付与挙動へ戻す
- チェックリスト:
  - 付与元のロジックを特定する
  - パス形式のみへ統一する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 16:00 JST step/mode クエリ付与の原因調査に着手。
  - done: 2026-01-05 16:01 JST useDialogUrlSync をパス優先に更新し、step/mode のクエリ付与を抑止。

2088) chore/ui/dialog-backdrop-dismiss-icon (P2) — 完了 (2026-01-05)
- ブランチ名: chore/ui/dialog-backdrop-dismiss-icon
- 依存: なし
- 受け入れ基準: 「ダイアログ外クリックで閉じる」アイコンが DisabledByDefault に変更される／設定挙動は維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx` の差分を revert し、従来のアイコンに戻す
- チェックリスト:
  - アイコン差し替え対象を特定する
  - DisabledByDefault に変更する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:59 JST ダイアログ外クリック設定のアイコン変更に着手。
  - done: 2026-01-05 15:59 JST DisabledByDefault アイコンへの差し替えを確認。

2087) feat/ui/plugin-dialog-route-path-mode-step (P1) — 完了 (2026-01-05)
- ブランチ名: feat/ui/plugin-dialog-route-path-mode-step
- 依存: なし
- 受け入れ基準: PluginDialogRoute の URL が `/t/:treeId/:pageNodeId/:targetNodeId?/:nodeType?/:action?/:mode?/:step?` 形式で動作する／旧クエリ形式から新パス形式へ移行する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/tree/PluginDialogRoute.tsx`, `app/src/router/routes/tree/dialogRoute.tsx`, `app/src/router/routes/tree/shared.ts`, `app/src/router/index.tsx`, `app/src/router/routes/t.($treeId).($pageNodeId).tsx`, `app/src/hooks/treeconsole/actions/dialog.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`, `packages/plugin-ui-host/docs/ARCHITECTURE.md`, `packages/plugin-base/README.md`, `app/src/router/README.md`
- ロールバック手順: 上記ファイルの差分を revert し、クエリパラメータ形式のルーティングへ戻す
- チェックリスト:
  - ルート定義とパラメータ解釈を更新する
  - 旧クエリパラメータとの互換性/移行を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:43 JST PluginDialogRoute のパス形式刷新に着手。
  - done: 2026-01-05 15:44 JST mode/step をパス化し、ルート定義とURL同期を更新。

2086) feat/ui/dialog-backdrop-dismiss-toggle (P1) — 完了 (2026-01-05)
- ブランチ名: feat/ui/dialog-backdrop-dismiss-toggle
- 依存: なし
- 受け入れ基準: PluginDialogRoute の外側クリックで閉じる挙動を設定で on/off できる／ツールバー設定メニューに Switch を追加する／既定は off／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/tree/PluginDialogRoute.tsx`, `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts`, `packages/util/src/treeConsoleSettings.ts`, `packages/ui/treeconsole/toolbar/src/components/TreeConsoleToolbar.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/TreeConsoleToolbarContent.tsx`, `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`, `packages/ui/treeconsole/toolbar/src/types.ts`, `packages/ui/dialog/src/headless/PluginDialogFrame.tsx`, `packages/plugin-ui-host/src/headless/PluginDialogShell.tsx`, `packages/ui/i18n/public/locales/en/common.json`, `packages/ui/i18n/public/locales/ja/common.json`
- ロールバック手順: 上記ファイルの差分を revert し、外側クリックで閉じる挙動と設定メニューの追加を取り消す
- チェックリスト:
  - ダイアログ外クリックの制御ポイントを特定する
  - 設定の保存/参照場所を追加する
  - ツールバー設定メニューに Switch を追加する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 15:30 JST ダイアログ外クリックのトグル設定追加に着手。
  - done: 2026-01-05 15:31 JST 外側クリックで閉じる設定の保存/切替とツールバーSwitchを追加。

2085) fix/ui/tile-config-section-render-loop (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/tile-config-section-render-loop
- 依存: なし
- 受け入れ基準: VTConfigSection の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`
- ロールバック手順: `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - VTConfigSection のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:35 JST VTConfigSection の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:36 JST zoomBreakpoints の比較を値ベースに修正し、同期ループを抑止。

2084) fix/ui/download-retry-controls-render-loop (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/download-retry-controls-render-loop
- 依存: なし
- 受け入れ基準: DownloadRetryControls の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - DownloadRetryControls のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:33 JST DownloadRetryControls の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:34 JST useFetchConfigSection の loadCounts effect 依存を整理し、無限レンダーを抑止。

2068) docs/shape-plugin/geojson-vector-tile-build-flow (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/geojson-vector-tile-build-flow
- 依存: なし
- 受け入れ基準: shape-plugin のビルドにおける geojson 方式ベクトルタイル生成の処理内容を段階的に説明する／参照すべき実ファイルの場所を列挙する／TASKS.md に運用ログを記載する
- 要点：shape-plugin の vectortile ステージで geojson 入力が選択された場合の入出力バッファ作成・worker 実行・タイル生成までのフローを整理し、参照ファイルを列挙。
- チェックリスト:
  - geojson 方式のベクトルタイル生成フローを調査して整理する
  - 参照すべきファイルパスを具体的に列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:05 JST shape-plugin の geojson 方式ベクトルタイル生成フロー調査に着手。
  - done: 2026-01-09 21:20 JST geojson 方式の vectortile 生成フローと参照ファイルを整理。

2069) docs/shape-plugin/extract2-buffer-format-check (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/extract2-buffer-format-check
- 依存: なし
- 受け入れ基準: extract2 のバッファ保存形式が標準で flatgeobuf であるかをコードで確認する／参照箇所を列挙する／TASKS.md に運用ログを記載する
- 要点：extract2 は flatgeobuf の geojson.serialize を使って保存しており、raw/extract1 も同様に flatgeobuf を保存していることを確認。
- チェックリスト:
  - extract2 の保存経路とフォーマットをコードで確認する
  - 参照すべきファイルパスを列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:24 JST extract2 のバッファ保存フォーマット確認に着手。
  - done: 2026-01-09 21:29 JST extract2 は flatgeobuf を保存していることを確認。

2070) docs/shape-plugin/vectortile-bottleneck-analysis (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/vectortile-bottleneck-analysis
- 依存: なし
- 受け入れ基準: vectortile ステージの処理を分解しボトルネック候補を列挙する／各候補の理由を具体的に説明する／参照ファイルを列挙する／TASKS.md に運用ログを記載する
- チェックリスト:
  - vectortile ステージの処理フローを整理する
  - ボトルネック候補と根拠を列挙する
  - 参照ファイルパスを具体的に記載する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:33 JST vectortile ステージのボトルネック推測整理に着手。
  - done: 2026-01-09 21:40 JST ボトルネック候補と根拠、参照箇所を整理。

2071) docs/shape-plugin/vectortile-qa-followups (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/vectortile-qa-followups
- 依存: なし
- 受け入れ基準: chunk-store 書き込み経路と理由をコードで説明する／geojson-vt の対象範囲をコードで説明する／Worker並列数の妥当性を推測する／Step6のプログレッシブ表示の可否をコードで確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store 書き込み経路と理由を確認する
  - geojson-vt の対象範囲とタイル交差の関係を整理する
  - Worker並列数の妥当性を推測し根拠を示す
  - Step6 のプログレッシブ表示可否を確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 21:50 JST vectortile 周辺の追加QAに着手。
  - done: 2026-01-09 22:05 JST chunk-store 経路、geojson-vt 対象範囲、並列度、Step6進行表示の可否を整理。

2072) docs/shape-plugin/chunk-store-overhead-benefit (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-overhead-benefit
- 依存: なし
- 受け入れ基準: chunk-store 経由のCPU/I/Oオーバーヘッド要因を整理する／chunk-store を介するメリットをコード根拠から説明する／推測と事実を分けて回答する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store 経由の処理コストを整理する
  - chunk-store を介する利点を整理する
  - 事実と推測を分けて回答する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:12 JST chunk-store 経由のオーバーヘッドと利点の整理に着手。
  - done: 2026-01-09 22:18 JST chunk-store 経由のコストとメリットを整理。

2073) docs/shape-plugin/chunk-store-overhead-quantitative (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-overhead-quantitative
- 依存: なし
- 受け入れ基準: gzipなしのchunk-store読み書きの追加オーバーヘッド要因を整理する／IndexedDB直書きとの差分を推測として明示する／不確実性と測定ポイントを明示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - gzipなしのchunk-store経路の差分要因を整理する
  - 推測と事実を分けて説明する
  - 測定が必要な点を列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:25 JST gzipなしのchunk-storeオーバーヘッド整理に着手。
  - done: 2026-01-09 22:30 JST chunk-storeとIndexedDB直書き差分の推測を整理。

2074) docs/shape-plugin/chunk-store-chunk-size-qa (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-chunk-size-qa
- 依存: なし
- 受け入れ基準: chunk-store のチャンクサイズ指定可否をコードで確認する／「直書きと同等になるか」を推測として明示する／不確実性を明示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - chunk-store のチャンク分割仕様を確認する
  - 直書き相当になるかを推測で整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 22:38 JST chunk-storeのチャンクサイズ可否の確認に着手。
  - done: 2026-01-09 22:45 JST chunk-storeは単一チャンク保存が基本で直書きと同等ではない点を整理。

2075) docs/shape-plugin/chunk-store-sharing-qa (P2) — 完了 (2026-01-09)
- ブランチ名: docs/shape-plugin/chunk-store-sharing-qa
- 依存: なし
- 受け入れ基準: downloadステージにおけるchunk-store利用と共有の仕組みをコードで確認する／参照カウント方式の有無を明確にする／正しい点/誤解点を分けて回答する／TASKS.md に運用ログを記載する
- チェックリスト:
  - downloadでのchunk-store利用経路を確認する
  - nodeId/セッション間共有の仕組みを確認する
  - 参照カウント方式の有無を明確化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 23:00 JST chunk-store共有理解の確認に着手。
  - done: 2026-01-09 23:08 JST 共有と参照関係の実装有無を整理。

2076) feat/shape/chunk-store-cache-and-cleanup (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/chunk-store-cache-and-cleanup
- 依存: なし
- ExecPlan: plans/shape-chunk-store-cache-and-cleanup-execplan.md
- 受け入れ基準: shape download のchunk-store利用がnodeId単位で参照関係を作成する／chunk-storeがHEAD+ETag/Last-Modifiedでキャッシュ判定する／hash同一性の利用状況を明確化し必要なら適用する／TreeNode削除経路でchunk-storeのdeleteForNodeが実行され参照0ならデータが削除される／TASKS.mdに運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`, `plugins/shape-plugin/src/services/datasources/*.ts`, `plugins/shape-plugin/src/services/utils/chunkStore.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/worker/plugin.ts`（必要に応じて）
- ロールバック手順: 上記ファイルとExecPlanの差分をrevertし、chunk-storeのHEAD判定とnodeId関連付けを元に戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - chunk-storeのHEAD判定と条件付きキャッシュを実装する
  - shape data sourceのchunk-store利用をnodeId関連付けに変更する
  - node削除経路でchunk-storeのdeleteForNodeが走るようにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 23:20 JST chunk-storeキャッシュ/削除の改善に着手。
  - done: 2026-01-10 00:10 JST HEAD判定・nodeId関連付け・削除連携を実装。検証: 未実施。

2077) refactor/shape/ephemeral-stage-buffers (P1) — 進行中 (2026-01-10)
- ブランチ名: refactor/shape/ephemeral-stage-buffers
- 依存: なし
- ExecPlan: plans/shape-ephemeral-stage-buffers-execplan.md
- 受け入れ基準: extract1入力はchunk-storeのダウンロードキャッシュを利用し、extract2/vectortileの入出力はsourceBuffersへ移行される／extract2SourceBuffersはnodeId+国コード+自治体レベルで検索できる／vectortileSourceBuffersはnodeId+tileIdで検索できる／TreeNode削除で対象バッファが一括削除される／TASKS.mdに運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて）
- ロールバック手順: 上記ファイルとExecPlanの差分をrevertし、chunk-store入力経路と旧bufferスキーマに戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - sourceBuffersのスキーマとインデックスを追加する
  - extract1入力はchunk-store利用、extract2/vectortileの入出力をsourceBuffersへ移行する
  - node削除で新バッファが削除されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 00:20 JST chunk-store依存をephemeral buffersへ移行する対応に着手。
  - start: 2026-01-10 09:42 JST extract1/2/vectortileのephemeral buffers移行とスキーマ更新に着手。
  - start: 2026-01-10 11:20 JST sourceBuffersのスキーマ追加とextract2/vectortile経路の置換を進行中。
  - start: 2026-01-10 11:45 JST downloadのchunk-store共有/削除とextract1入力の確認に着手。
  - start: 2026-01-10 12:45 JST download出力をchunk-storeへ保存しextract1入力をchunk-store参照に変更。
  - start: 2026-01-10 13:05 JST extract1入力をchunk-store決め打ちへ修正・downloadのrawBuffers廃止方針で対応を進める。
  - start: 2026-01-10 13:30 JST extract1入力のchunk-store固定化とrawBuffers廃止、nodeId必須化の整理に着手。

2078) chore/docs/agents-no-fallback (P2) — 完了 (2026-01-10)
- ブランチ名: chore/docs/agents-no-fallback
- 依存: なし
- 受け入れ基準: AGENTS.md に「ユーザー指示なしのフォールバック実装を禁止」ルールを明記する／TASKS.md に運用ログを記載する
- チェックリスト:
  - AGENTS.md にフォールバック禁止ルールを追記する
  - 運用ログ start を追記する
- 運用ログ：
  - start: 2026-01-10 13:20 JST フォールバック実装禁止ルールをAGENTS.mdへ反映する対応に着手。
  - done: 2026-01-10 18:50 JST AGENTS.md にフォールバック禁止ルールを追記済みであることを確認。

2079) feat/shape/step6-progressive-display (P1) — 完了 (2026-01-10)
- ブランチ名: feat/shape/step6-progressive-display
- 依存: 2077
- ExecPlan: plans/shape-step6-progressive-display-execplan.md
- 受け入れ基準: Step6の遷移条件が「メタデータまたはタイルの存在」で即OKになる／downloadステージでメタデータ基本レコードを永続化し後続ステージで頂点数・フィーチャー数等を段階的に書き込み更新する／Step6のメタデータ一覧が段階的に増える・更新される／nodeId必須とフォールバック禁止の方針が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps`, `plugins/shape-plugin/src/ui/hooks`, `plugins/shape-plugin/src/services/metadata`, `plugins/shape-plugin/src/services/batch`, `packages/runtime-worker/src/services`（必要に応じて）
- ロールバック手順: Step6遷移条件とメタデータ集計の差分をrevertし、従来の集計完了後遷移の挙動に戻す
- チェックリスト:
  - ExecPlanを作成し設計と検証手順を明記する
  - Step6遷移条件を「メタデータまたはタイル存在」で許可する
  - downloadステージでメタデータ基本レコードを永続化する
  - 後続ステージで統計を段階的に更新する
  - Step6の一覧表示が段階的に更新されることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 14:05 JST Step6のプログレッシブ表示とメタデータ段階更新に着手。
  - done: 2026-01-10 14:40 JST Step6遷移条件をメタデータ/タイル存在で許可し、Previewメタデータのポーリング更新を追加。検証: 未実施。

2080) refactor/shape/extract-buffer-naming-align (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/extract-buffer-naming-align
- 依存: なし
- 受け入れ基準: ShapeBuildAPIClient.ts の型不整合を解消する／Extract1SourceBuffer/Extract2SourceBuffer の命名へ統一する／関連型とAPIの参照が揃っている／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-service-api/src/types/*`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/shape-store/src/index.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `plugins/shape-plugin/src/services/batch/*`, `packages/runtime-worker/src/services/*`（必要に応じて）
- ロールバック手順: 上記ファイルの命名/型変更を revert し、従来の ShapeExtractedBufferRecord / ExtractedFeatureBuffer 名称へ戻す
- チェックリスト:
  - ShapeBuildAPIClient.ts の型不整合箇所を修正する
  - Extracted 系の命名を SourceBuffer 系へ統一する
  - 参照箇所の型と実体が一致していることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 15:05 JST extractバッファ命名の統一と型不整合修正に着手。
  - done: 2026-01-10 15:35 JST ShapeBatchApiClient の listExtractedBuffers を復旧し、Extract1/2SourceBuffer 命名と型参照を統一。検証: 未実施。

2081) fix/shape/vectortile-no-empty-tileid (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/vectortile-no-empty-tileid
- 依存: なし
- 受け入れ基準: vectortile の tileId 関係が空のフォールバックを撤去し失敗扱いにする／tileId が空を許容する型定義を修正する／関連参照が更新されている／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `packages/features/shape-store/src/ShapeDB.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、tileId 未設定時のフォールバックと型定義を元に戻す
- チェックリスト:
  - tileId 関係が空のフォールバックを削除する
  - tileId が空を許容する型定義を修正する
  - 参照先の型エラーを解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 16:05 JST vectortile の tileId 空フォールバック撤去に着手。
  - done: 2026-01-10 16:30 JST tileId 関係なしのフォールバックを撤去し、tileId必須型へ更新。検証: 未実施。

2082) fix/shape/vectortile-input-typing (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/vectortile-input-typing
- 依存: なし
- 受け入れ基準: RuntimeWorkerVectorTileAdapter の {} フォールバックを撤去し入力型を明示する／ShapeExtractedBufferRecord の参照を ShapeExtractSourceBufferRecord に統一する／未使用変数の警告を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/SessionArtifactStore.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、入力のフォールバック/旧型参照へ戻す
- チェックリスト:
  - VectorTileAdapter の入力取得を明示型で強制する
  - ShapeExtractSourceBufferRecord へ参照を統一する
  - 未使用変数の警告を解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 17:00 JST vectortile 入力型の厳格化とフォールバック撤去に着手。
  - done: 2026-01-10 17:20 JST VectorTileAdapter の {} フォールバックを撤去し、ExtractSourceBuffer 参照を統一。検証: 未実施。

2083) fix/shape/datasource-nonempty (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/datasource-nonempty
- 依存: なし
- 受け入れ基準: toDataSourceName から trim を撤去し、入力型を非空文字列に限定する／generateDownloadTaskPayloadsFromSelection 経路で dataSource が undefined/空にならないよう型と検証を修正する／フォールバック禁止を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/common/types`, `plugins/shape-plugin/src/services`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、従来の toDataSourceName/入力処理へ戻す
- チェックリスト:
  - dataSource の型を非空文字列に制約する
  - toDataSourceName の trim 依存を撤去する
  - generateDownloadTaskPayloadsFromSelection の入力検証を明示化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:05 JST dataSource の非空型化と trim 撤去に着手。
  - start: 2026-01-10 18:40 JST dataSource 必須化の整理とAPI型更新に再着手。
  - done: 2026-01-10 18:55 JST dataSource の trim/フォールバック撤去とAPI境界の必須化を反映。検証: 未実施。

2084) fix/shape/download-payloads-require-nodeid (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/download-payloads-require-nodeid
- 依存: なし
- 受け入れ基準: generateShapeDownloadTaskPayloadsFromSelection の引数に nodeId を追加し、UI→worker→shapeBatchAPI の呼び出しで nodeId が渡される／dataSource が欠落したまま呼ばれない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/WorkerAPI.ts`, `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/ui/hooks/*`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧シグネチャへ戻す
- チェックリスト:
  - WorkerAPI のシグネチャに nodeId を追加する
  - worker-runtime で shapeBatchAPI へ nodeId を渡す
  - UI 呼び出し側で nodeId を必須化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:10 JST generateShapeDownloadTaskPayloadsFromSelection の nodeId 欠落修正に着手。
  - done: 2026-01-10 19:20 JST WorkerAPI/worker-runtime/UI 呼び出しに nodeId を追加。検証: 未実施。

2085) refactor/shape/typed-download-payloads-entry (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/typed-download-payloads-entry
- 依存: なし
- 受け入れ基準: generateShapeDownloadTaskPayloadsFromSelection の引数が nodeId/DataSourceName 必須で型保証される／UI からの呼び出しが dataSource 未確定時にビルドで落ちる形になる／worker 入口で string を受け取らない型になる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/common/api/src/WorkerAPI.ts`, `app/src/worker-runtime/worker.ts`, `plugins/shape-plugin/src/ui/hooks/*`, `plugins/shape-plugin/src/worker/public.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧シグネチャと緩い型へ戻す
- チェックリスト:
  - WorkerAPI の型を DataSourceName で固定する
  - worker-runtime の引数型を更新する
  - UI 呼び出しで dataSource 未設定を型で禁止する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:30 JST generateShapeDownloadTaskPayloadsFromSelection の型厳格化に着手。
  - done: 2026-01-10 19:45 JST WorkerAPI/worker-runtime/shape worker で nodeId+ShapeDataSourceName 必須化と selection 非optional 化を反映。検証: 未実施。

2086) fix/shape/step3-delete-download-button-refresh (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/step3-delete-download-button-refresh
- 依存: なし
- 受け入れ基準: Step3 の「ダウンロード済みファイルを削除(N件)」ボタンが削除後に件数0へ更新され、無効化される／削除完了後に UI 状態が再取得される／TASKS.md に運用ログを記載する
- 影響範囲: `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、削除後に relation が残る挙動へ戻す
- チェックリスト:
  - 削除完了後に download 状態を再取得する
  - ボタンラベルと disabled が一致する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:05 JST Step3 削除ボタンの状態更新修正に着手。
  - done: 2026-01-10 20:20 JST chunk-store の deleteAllForNode を relation 直接削除に変更し、削除後の件数更新を保証。検証: 未実施。

2087) refactor/shape/remove-legacy-datasource (P1) — 完了 (2026-01-10)
- ブランチ名: refactor/shape/remove-legacy-datasource
- 依存: なし
- 受け入れ基準: dataSourceName のレガシー参照/フォールバックを削除し、batchConfig.dataSource を唯一の参照点にする／未設定時は明示エラーで止まる／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/common/types/ShapeEntity.ts`, `plugins/shape-plugin/src/ui/hooks/*`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/services/utils/utils.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、dataSourceName の参照を復帰する
- チェックリスト:
  - dataSourceName の参照を削除する
  - batchConfig.dataSource 未設定時に明示エラーで止まる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 20:35 JST dataSourceName レガシー参照の削除に着手。
  - done: 2026-01-10 21:05 JST dataSourceName の参照を削除し batchConfig.dataSource に統一。検証: 未実施。

2088) fix/shape/download-stalls-after-two (P1) — 完了 (2026-01-10)
- ブランチ名: fix/shape/download-stalls-after-two
- 依存: なし
- 受け入れ基準: download が2タスクで止まる原因を特定し、必要なら修正する／停止が正常待機の場合は根拠を示す／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/*`, `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、旧挙動へ戻す
- チェックリスト:
  - download ステージの停止要因を特定する
  - 必要なら修正し再現を防ぐ
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:20 JST download が2タスクで止まる問題の調査に着手。
  - done: 2026-01-10 21:30 JST NaturalEarth では adminLevel 単位で2タスクに集約される設計であることを確認。検証: 未実施。

2089) fix/shape/geoboundaries-cache-complete (P1) — 進行中 (2026-01-10)
- ブランチ名: fix/shape/geoboundaries-cache-complete
- 依存: なし
- 受け入れ基準: geoboundaries の download でキャッシュヒット時に task を completed に更新できる／0/230 停滞を解消する／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `packages/features/chunk-store/src/index.ts`（必要に応じて）
- ロールバック手順: 上記ファイルの差分を revert し、従来のキャッシュ判定/完了更新に戻す
- チェックリスト:
  - cache hit 時の task 更新経路を修正する
  - download の 0/230 停滞が解消する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 21:45 JST geoboundaries のキャッシュ完了更新不備の調査に着手。
  - start: 2026-01-10 22:30 JST geoboundaries の download 停滞原因をコードで再調査。
  - done: 2026-01-10 23:20 JST download 入力のフォールバックを撤廃し、DownloadTaskPayload/DownloadStageOutput を必須化して入力欠落時に即時エラー化。download キャッシュ判定も入力必須に統一。検証: 未実施。
  - start: 2026-01-10 23:35 JST Step2 未選択時の Step3 直アクセスをリダイレクトし、テンプレート dataSource 明示を確認する対応に着手。
  - done: 2026-01-10 23:45 JST Step3 で dataSource 未設定なら URL step=2 に戻し、Step3 側は空表示で待機するよう変更。検証: 未実施。

2067) fix/ui-dialog/maximize-layout-viewport (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui-dialog/maximize-layout-viewport
- 依存: なし
- 要点：最大化時の layoutViewport が実ウィンドウサイズより小さくなる問題を避けるため、layoutViewport は innerWidth/innerHeight を優先するように変更。
- 原因/影響範囲：layoutViewport が visualViewport/screen の最小値を採用していたため、ウィンドウ拡大時に最大化サイズが小さめに正規化されるケースがあった。影響範囲は `packages/ui/dialog/src/headless/frameHelpers.ts`。
- 修正内容と適用範囲：getDialogLayoutViewport を window.innerWidth/innerHeight 優先（screen はフォールバック）へ変更。適用範囲は `packages/ui/dialog/src/headless/frameHelpers.ts`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: layoutViewport の検出と正規化処理の不整合を特定する／最大化時にウィンドウ拡大後でも中央寄せが崩れないよう修正する／TASKS.md に運用ログ・影響範囲・ロールバック手順を追記する
- 影響範囲: `packages/ui/dialog/src/headless/frameHelpers.ts`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - layoutViewport の算出ロジックを見直して実ウィンドウサイズを優先する
  - 最大化時の正規化が実ウィンドウサイズに追従することを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 07:33 JST layoutViewport の正規化不整合の修正に着手。
  - done: 2026-01-05 07:33 JST layoutViewport を innerWidth/innerHeight 優先に更新。検証: 未実施（UI 操作のみ）。

2066) fix/plugin-ui-host/dialog-maximize-center (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-maximize-center
- 依存: なし
- 要点：最大化時の中央寄せが崩れる原因として、正規化時のビューポート基準が不一致だったため、最大化時はレイアウト用ビューポートで正規化するように修正。
- 原因/影響範囲：最大化時のサイズ算出に layoutViewport を使いつつ正規化は viewport を使っていたため、位置補正がずれて右寄り・上寄りになるケースがあった。影響範囲は `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`。
- 修正内容と適用範囲：最大化/全画面時の正規化に layoutViewport を使うよう統一し、中央寄せを維持。適用範囲は `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: 最大化時に中央寄せが崩れる原因を特定して修正する／最大化時の位置算出が中央寄せになることを確認する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController/frame-state.ts`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - 最大化時の位置算出と正規化処理の不整合を修正する
  - 画面サイズ変更時の最大化レイアウトが中央寄せになることを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 07:25 JST 最大化時の中央寄せ崩れの原因調査と修正に着手。
  - done: 2026-01-05 07:26 JST 最大化時の正規化を layoutViewport 基準へ統一。検証: 未実施（UI 操作のみ）。

2065) fix/plugin-ui-host/dialog-header-restore-position (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-header-restore-position
- 依存: なし
- 要点：復元ツールチップを「元に戻す」に変更し、最大化/全画面への遷移時に元の位置・サイズを保存、復元時に保存値で戻すようにした。全画面/最大化のレイアウトはビューポート/スクリーンから算出する。
- 原因/影響範囲：最大化/全画面の復元が初期中心位置・サイズに戻るだけで、元の位置・サイズが保持されていなかった。影響範囲は DialogUIState とフレーム遷移ロジック、ツールチップ文言。
- 修正内容と適用範囲：DialogUIState に restorePosition/restoreSize を追加し、最大化/全画面遷移時に保存・復元時に使用するよう更新。最大化/全画面のサイズ計算は viewport + screen の検出値を使う。適用範囲は `packages/common/types/src/dialog-state.ts`, `packages/ui/dialog/src/headless/frameHelpers.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`, `packages/plugin-ui-host/src/headless/components/PluginDialogControls.tsx`, `app/public/locales/*/common.json`, `packages/ui/i18n/public/locales/*/common.json`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: 「元のサイズに戻す」ツールチップを「元に戻す」に変更する／最大化・全画面移行時に元の位置/サイズを DialogUIState へ保存する／全画面・最大化のレイアウトはビューポート/スクリーン検出で算出した値を使用する／「元に戻す」は保存した元の位置/サイズに復帰する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/common/types/src/dialog-state.ts`, `packages/ui/dialog/src/headless/frameHelpers.ts`, `packages/plugin-ui-host/src/headless/usePluginDialogController/*`, `packages/plugin-ui-host/src/headless/components/PluginDialogControls.tsx`, `app/public/locales/*/common.json`, `packages/ui/i18n/public/locales/*/common.json`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - 「元のサイズに戻す」を「元に戻す」へ変更する
  - 最大化/全画面化の直前に元の位置/サイズを保存する
  - 最大化/全画面のレイアウトをビューポート/スクリーン検出で算出する
  - 元に戻す際は保存した元の位置/サイズに復帰する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 00:29 JST PluginDialogHeader の復元ツールチップと位置/サイズ復帰対応に着手。
  - done: 2026-01-05 00:43 JST 最大化/全画面の復元位置・サイズ保持とツールチップ文言変更を反映。検証: 未実施（UI 操作のみ）。

2064) fix/plugin-ui-host/dialog-header-doubleclick (P1) — 完了 (2026-01-05)
- ブランチ名: fix/plugin-ui-host/dialog-header-doubleclick
- 依存: なし
- 要点：ヘッダ背景のダブルクリックで通常/最大化をトグルし、全画面時は無効化した。
- 原因/影響範囲：PluginDialogHeader でダブルクリックによる状態切替が未実装だった。影響範囲は `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`。
- 修正内容と適用範囲：ヘッダの Box に onDoubleClick を追加し、full-screen をガード。ステッパーや操作ボタン領域のダブルクリックは伝播を停止。適用範囲は `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`。
- 検証：未実施（UI 操作のみ）。
- 受け入れ基準: PluginDialogHeader のヘッダ背景ダブルクリックで通常/最大化をトグルできる／全画面状態ではダブルクリックで状態が変わらない／既存のヘッダ操作に影響がない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/components/PluginDialogHeader.tsx`
- ロールバック手順: 上記ファイルと本項目の差分を revert して元に戻す
- チェックリスト:
  - ヘッダ背景ダブルクリックで通常/最大化のトグルを実装する
  - 全画面時はトグルしないガードを入れる
  - 既存のクリック/ボタン操作への影響がないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 00:28 JST PluginDialogHeader のダブルクリックで最大化トグル実装に着手。
  - done: 2026-01-05 00:29 JST ヘッダ背景のダブルクリックで最大化トグルを追加。検証: 未実施（UI 操作のみ）。

2063) refactor/shape-plugin/batch-storage-ephemeral (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/shape-plugin/batch-storage-ephemeral
- 依存: なし
- 受け入れ基準: batchTasks を hdb-shape-ephemeral へ移設し hdb-shape 側を撤去する／TreeNode削除時に batchSessions を削除する／バッチ成功時に Step3 の保持スイッチ設定に従って batchTasks を自動削除する／rawBuffers の chunk-store 経由書き込みを撤去し ephem 保存へ統一する／ShapeEphemeralDBAPI を追加し ShapeDB/ShapeEphemeralDB の直接読み書きを API 経由へ統一する／参照先を一括で更新する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-service-api/src/types`, `packages/common/api/src/WorkerAPI.ts`, `packages/runtime-worker/src/services`, `packages/features/shape-store/src/ShapeDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `plugins/shape-plugin/src/services/batch`, `plugins/shape-plugin/src/worker/api.ts`, `packages/runtime-worker/src/entity/EntityLifecycleManager.ts`（他参照先含む）
- ロールバック手順: batchTasks の参照/定義と rawBuffers 書き込み経路を元に戻し、TreeNode削除連動の batchSessions 削除を撤回する
- チェックリスト:
  - hdb-shape の batchTasks を撤去し、ephemeral に移設する
  - TreeNode削除時に batchSessions を削除する
  - Step3 の保持スイッチに従って成功時に batchTasks を自動削除する
  - rawBuffers の chunk-store 経由書き込みを撤去する
  - ShapeEphemeralDBAPI を追加し、ShapeDB/ShapeEphemeralDB の直接読み書きを API 経由へ統一する
  - 参照先をまとめて更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 20:10 JST shape-plugin の batchTasks 移設と rawBuffers 経路整理に着手。
  - start: 2026-01-05 00:43 JST ShapeEphemeralDBAPI/BatchTasks 移設/削除連動の継続対応に着手。

2058) chore/remove/runtime-stage-worker (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/runtime-stage-worker
- 依存: なし
- 受け入れ基準: `packages/features/runtime-stage-worker` を削除し参照/依存を撤去する／計画ドキュメントの runtime-stage-worker 記述を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：runtime-stage-worker パッケージを削除し、計画ドキュメントと pnpm-lock の参照を整理。
- 影響範囲: `packages/features/runtime-stage-worker`, `docs/refactoring-plan-shape-to-location-route.md`, `pnpm-lock.yaml`
- 検証：未実施（削除作業のみ）。
- ロールバック手順: runtime-stage-worker パッケージと pnpm-lock のエントリ、計画ドキュメントの記述を復元する
- チェックリスト:
  - runtime-stage-worker パッケージを削除する
  - 参照ドキュメント/ロックファイルを整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 19:40 JST runtime-stage-worker の削除作業に着手。
  - done: 2026-01-09 19:46 JST runtime-stage-worker を削除し、計画ドキュメントと lockfile を整理。検証: 未実施。

2061) fix/ui-treeconsole-toolbar/shared-zoom-range-guard (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/ui-treeconsole-toolbar/shared-zoom-range-guard
- 依存: なし
- 受け入れ基準: SettingsMenu の shared zoom range 変更で TS2322 が解消する／min/max が未定義の場合でも安全に動作する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx`
- ロールバック手順: shared zoom range のガード追加を revert して元に戻す
- チェックリスト:
  - Slider onChange の min/max ガードを追加する
  - typecheck でエラーが出ないことを確認する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 17:20 JST shared zoom range の TS2322 修正に着手。
  - done: 2026-01-09 17:22 JST Slider の min/max 未定義をガードして型エラーを解消。検証: 未実施。

2062) fix/shape-plugin/step5-download-stuck (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/step5-download-stuck
- 依存: なし
- 受け入れ基準: Step5 の Download タスクが開始ボタン押下で進捗する／Step4 の「ダウンロードタスク済みファイル」削除ボタンがタスク残存時に有効化される／リロード後に残留したタスクが整合する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/ui/hooks/useFetchConfigSection.ts`
- ロールバック手順: download タスクの再開リセット処理と delete 有効化条件を revert して元に戻す
- チェックリスト:
  - Download タスクの再開時に running を waiting へ戻す
  - タスク残存時に削除ボタンが有効になるよう条件を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 19:55 JST Step5 の download タスク停滞と削除ボタン無効の修正に着手。
  - done: 2026-01-09 20:10 JST download 再開時の running → waiting リセットと Step4 削除ボタン有効化/削除時の pause を反映。検証: 未実施。

2063) test/verify/smart-fetch-chunk-store (P1) — 進行中 (2026-01-09)
- ブランチ名: test/verify/smart-fetch-chunk-store
- 依存: なし
- 受け入れ基準: @hierarchidb/smart-fetch と @hierarchidb/chunk-store の利用経路を整理する／既存テストの内容を確認し不足があれば最小修正または追加する／関連テストを実行して結果を記録する／TASKS.md に運用ログ・影響範囲・検証結果を記載する
- 影響範囲: `packages/features/download`, `packages/features/chunk-store`, `plugins/shape-plugin`（必要に応じて）
- ロールバック手順: テスト追加/修正の差分を revert して元に戻す
- チェックリスト:
  - smart-fetch/chunk-store の使用箇所と経路を確認する
  - 既存テストの内容を確認し必要な修正/追加を行う
  - 関連テストを実行し結果を運用ログに記載する
- 運用ログ：
  - start: 2026-01-09 20:15 JST smart-fetch/chunk-store のテスト確認と実行に着手。
  - done: 2026-01-09 20:20 JST smartFetch/DexieChunkStore テストを追加し、FetchNetworkPort.throttle を auth 無効化で修正。検証: `pnpm exec vitest run --config packages/features/download/vitest.config.ts` / `pnpm exec vitest run --config packages/features/chunk-store/vitest.config.ts`（成功）。

2058) test/shape-plugin/enable-headless-batch (P1) — 進行中 (2026-01-09)
- ブランチ名: test/shape-plugin/enable-headless-batch
- 依存: なし
- 受け入れ基準: shape-plugin の headless バッチテストがスキップされずに実行可能になる／実アプリ相当の依存を使い、Dexie は FakeIndexedDB を利用する／実行方法と注意点を TASKS.md に記録する
- 影響範囲: `plugins/shape-plugin/src/headless/shape-batch-progress.headless.test.ts`, `plugins/shape-plugin/vitest.setup.ts`（必要に応じて）
- ロールバック手順: headless テストの変更を revert してスキップ状態へ戻す
- チェックリスト:
  - headless テストを実行可能にし、実アプリ相当の依存構成で動作させる
  - Dexie を FakeIndexedDB に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:40 JST shape-plugin headless バッチテストの有効化に着手。
  - done: 2026-01-09 16:55 JST headless バッチテストを実行可能にし、FakeIndexedDB 前提の in-process 実行へ調整。検証: 未実施。

2057) chore/remove/compute-feature (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/compute-feature
- 依存: なし
- 受け入れ基準: `packages/features/compute` を削除し参照/依存を撤去する／runtime-worker の FeatureRegistry から compute を外す／ドキュメントの compute 参照を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/compute`, `packages/runtime-worker/src/services/FeatureBootstrap.ts`, `packages/runtime-worker/package.json`, `packages/features/batch/README.md`, `plugins/*/PLAN.md`, `plugins/shape-plugin/README.md`（必要に応じて）
- ロールバック手順: compute パッケージと参照を復元し、FeatureRegistry への登録を元に戻す
- チェックリスト:
  - compute パッケージと package.json 参照を削除する
  - runtime-worker の FeatureRegistry から compute を外す
  - ドキュメント/計画の compute 参照を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:10 JST @hierarchidb/compute の削除作業に着手。
  - done: 2026-01-09 16:25 JST compute パッケージを削除し、runtime-worker の FeatureRegistry/依存、tsconfig paths、関連ドキュメントの参照を整理。検証: 未実施。

2060) fix/shape-plugin/preview-tiles-availability (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/preview-tiles-availability
- 依存: なし
- 受け入れ基準: Step6 のプレビューでタイル生成済みなら地図が表示される／"No vector tiles are available yet" が誤判定で出ない／ui-map の tileDataProvider が runtime-worker のタイル取得に追従する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`
- ロールバック手順: useShapePreviewStep のタイル可用性判定と tileDataProvider を shapeDB 参照のみの実装へ戻す
- チェックリスト:
  - タイル可用性判定の参照元（runtime-worker/ローカル）を整理する
  - tileDataProvider が runtime-worker から取得できるようにする
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:45 JST Step6 プレビューのタイル判定修正に着手。
  - done: 2026-01-09 16:55 JST Step6 プレビューのタイル可用性判定を runtime-worker 経由に優先し、tileDataProvider も runtime-worker から取得するよう更新。検証: 未実施。
  - done: 2026-01-09 17:02 JST Step6 プレビューのタイル判定をローカルDB参照のみに戻し、runtime-worker 依存を撤去。検証: 未実施。

2059) refactor/ui-batch/rename-to-ui-batch-progress (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/ui-batch/rename-to-ui-batch-progress
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-batch を @hierarchidb/ui-batch-progress に改名し、import/依存/paths/文書の参照を更新する／旧名称参照が残らない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/batch`, `plugins/*-plugin`, `tsconfig.base.json`, `app/tsconfig.json`, `plans/*`, `packages/plugin-registry/generated/registry.ts`
- ロールバック手順: package.json の name と全参照を @hierarchidb/ui-batch に戻す
- チェックリスト:
  - パッケージ名と依存/インポートを更新する
  - tsconfig paths とプラグイン依存を更新する
  - 計画ドキュメントの記述を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 16:05 JST ui-batch → ui-batch-progress 改名に着手。
  - done: 2026-01-09 16:28 JST ui-batch を ui-batch-progress に改名し、依存/import/paths/計画文書/registry を更新。検証: 未実施。

2058) chore/analysis/ui-batch-usage (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/ui-batch-usage
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-batch の目的を一次情報から要約する／参照元（import/依存関係）を列挙し実際の利用有無を判断する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/batch`, `plugins/*-plugin`
- ロールバック手順: 調査のみのためロールバック不要
- チェックリスト:
  - ui-batch の目的と主要 exports を確認する
  - import 参照元を列挙する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:38 JST ui-batch の利用状況調査に着手。
  - done: 2026-01-09 15:44 JST ui-batch の hooks が shape/location/route プラグインで利用されていることを確認。検証: 調査のみ。

2057) chore/analysis/download-smart-fetch-status (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/download-smart-fetch-status
- 依存: なし
- 受け入れ基準: packages/features/download の現状と目的を整理する／smart-fetch という名称計画の有無と進捗を一次情報から確認する／再編・整理の進捗（完了/未完）を整理する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/download`, `plans/*`, `TASKS.md`
- ロールバック手順: 調査のみのためロールバック不要
- チェックリスト:
  - smart-fetch 名称の記述有無を確認する
  - download の現状/目的と整理状況をまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:22 JST download/smart-fetch 再編状況の調査に着手。
  - done: 2026-01-09 15:28 JST smart-fetch パッケージ名の記述は確認できず、download 内の smartFetch 実装が存在。download の再編は chunk-store 分離と API 整理まで完了、名称変更は未実施と判断。検証: 調査のみ。

2056) chore/remove/ui-gis (P1) — 進行中 (2026-01-09)
- ブランチ名: chore/remove/ui-gis
- 依存: なし
- 受け入れ基準: packages/ui/gis を削除し参照をすべて撤去する／tsconfig.base.json の ui-gis paths を削除する／計画ドキュメントの ui-gis 記述を ui-map へ更新する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/gis`, `tsconfig.base.json`, `plans/shape-ui-shared-packages.md`
- ロールバック手順: ui-gis のディレクトリと paths を復元し、参照を元に戻す
- チェックリスト:
  - ui-gis パッケージと参照を削除する
  - tsconfig.base.json の paths を更新する
  - 計画ドキュメントの記述を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 15:05 JST ui-gis の削除作業に着手。
  - done: 2026-01-09 15:14 JST packages/ui/gis を削除し、tsconfig.base.json の paths と計画ドキュメントの ui-gis 記述を ui-map に更新。検証: 未実施。

2055) refactor/ui-map/simple-full-components (P1) — 進行中 (2026-01-09)
- ブランチ名: refactor/ui-map/simple-full-components
- 依存: なし
- 受け入れ基準: ui-map にシンプル/フルスペックの地図表示コンポーネントを提供する／shape-plugin の preview で ui-gis 依存を撤去し ui-map へ移行する／ui-gis 提供が独自コンポーネント奨励に見えない構成にする／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src`, `plugins/shape-plugin/src`, `plugins/shape-plugin/package.json`, `packages/ui/gis`（必要に応じて）
- ロールバック手順: ui-map 追加コンポーネントと shape-plugin の import 変更を revert し、ui-gis 参照に戻す
- チェックリスト:
  - ui-map のシンプル/フルスペック UI コンポーネント設計を確定する
  - ui-gis のプレビュー用フックを ui-map に移動/統合する
  - shape-plugin の preview 依存を ui-map に切り替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 14:32 JST ui-map への統合と ui-gis 依存撤去に着手。
  - done: 2026-01-09 14:52 JST ui-map に Simple/Full Map コンポーネントとプレビュー用フックを追加し、shape-plugin の ui-gis 依存を ui-map に移行。ui-gis は ui-map への再エクスポートと deprecated 記述へ変更。検証: 未実施。

2054) chore/analysis/ui-gis-usage (P2) — 進行中 (2026-01-09)
- ブランチ名: chore/analysis/ui-gis-usage
- 依存: なし
- 受け入れ基準: @hierarchidb/ui-gis の目的を一次情報から要約する／参照元（import/依存関係）を列挙し実際の利用有無を判断する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/gis`, `plugins/shape-plugin`（参照確認のみ）
- ロールバック手順: 本項目は調査のみのためロールバック不要
- チェックリスト:
  - package.json/計画ドキュメントから目的を確認する
  - import/依存関係の参照元を列挙する
  - 実際の利用有無の判断を整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 14:18 JST @hierarchidb/ui-gis の目的と利用状況の調査に着手。
  - done: 2026-01-09 14:23 JST ui-gis の目的（ベクタタイルプレビュー系フックの共有化）と参照元（shape-plugin のプレビュー手順）を整理。検証: 調査のみ。

2053) fix/runtime-worker/worker-error-code-export (P1) — 進行中 (2026-01-09)
- ブランチ名: fix/runtime-worker/worker-error-code-export
- 依存: なし
- 受け入れ基準: commitOperations.ts で WorkerErrorCode の参照が実行時/型ともに解決する／Vite の "does not provide an export named 'WorkerErrorCode'" が再現しない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/commitOperations.ts`, `packages/runtime-worker/src/services/command-types.ts`（必要に応じて）
- ロールバック手順: WorkerErrorCode の export/参照変更を revert して元の import/export に戻す
- チェックリスト:
  - WorkerErrorCode が型/値どちらとして定義されているかを確認する
  - commitOperations.ts の import を実体に合わせて修正する
  - runtime-worker の export 状態を確認し、必要なら公開経路を整える
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 14:05 JST WorkerErrorCode の export/参照不整合の修正に着手。
  - done: 2026-01-09 14:12 JST WorkerErrorCode の値参照を WorkerErrorCodeValue に統一し、runtime-worker 内の import/参照を修正。検証: 未実施。

2052) fix/shape-plugin/batch-resume-stuck (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/shape-plugin/batch-resume-stuck
- 依存: なし
- 受け入れ基準: shape-plugin のバッチ再開時に全体進捗カードの "Primary Extraction ... 0/342 Completed failed 0 skipped 339" が残留せず、再開に応じて進捗が更新される／LRUSplitView の "No tasks yet" 3ペインのフラッシュが解消する／extract2 で tileId を生成して `shape-ephemeral` の `tileIdToBufferRelations`（nodeId+tileId の複合インデックス）に保存される／vectortile の入力生成が `tileIdToBufferRelations` を参照する／ツリーノード削除で `extractedBuffers` と `tileIdToBufferRelations` が削除される／ズームレンジUIが「0-12のレンジ選択」「n分割指定」「n+1ブレークポイント指定」に対応しデフォルトが 0-7 / n=2 / [0,4,7] である／extract2 がズーム範囲セット（n分割ブレークポイント）ごとにタスクを生成し、各タスク入力に対象ズーム範囲の識別情報が保持される／extract2 の単純化パラメータが各タスクの「最も詳細側のズーム率」に連動してスケールされる／extract2 完了後に vectortile のタスク群が開始される／Download Files を残したまま再開したケースの再現/解消手順を TASKS.md に記録する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
 - 受け入れ基準: shape-plugin のバッチ再開時に全体進捗カードの "Primary Extraction ... 0/342 Completed failed 0 skipped 339" が残留せず、再開に応じて進捗が更新される／LRUSplitView の "No tasks yet" 3ペインのフラッシュが解消する／extract2 で tileId を生成して `shape-ephemeral` の `tileIdToBufferRelations`（nodeId+tileId の複合インデックス）に保存される／vectortile の入力生成が `tileIdToBufferRelations` を参照する／ツリーノード削除で `extractedBuffers` と `tileIdToBufferRelations` が削除される／ズームレンジUIが「0-12のレンジ選択」「n分割指定」「n+1ブレークポイント指定」に対応しデフォルトが 0-7 / n=2 / [0,4,7] である／extract2 がズーム範囲セット（n分割ブレークポイント）ごとにタスクを生成し、各タスク入力に対象ズーム範囲の識別情報が保持される／extract2 の単純化パラメータが各タスクの「最も詳細側のズーム率」に連動してスケールされる／extract2 完了後に vectortile のタスク群が開始される／TopoJSON版の extract2/vectortile が z0/z1-4/z5-9 の集約方針に従い再構築され、タイルBBox拡張（係数/マージン）で周辺国/大陸を合成したTopoJSONから簡略化・flatgeobuf化・tileId索引化する／Step4で拡張係数とマージンを設定でき、extract2 に反映される／Download Files を残したまま再開したケースの再現/解消手順を TASKS.md に記録する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch`, `plugins/shape-plugin/src/services/batch/workers`, `plugins/shape-plugin/src/common/types`, `plugins/shape-plugin/src/worker`, `packages/features/shape-store/src`, `packages/plugin-service-api/src`, `packages/runtime-worker/src`（必要に応じて）
- ロールバック手順: shape-plugin の tileId 関連差分と shape-ephemeral の新規テーブル定義を revert して元の挙動に戻す
- チェックリスト:
  - 再開時に進捗が更新されない条件と再現手順を特定する
  - 進捗の復元/購読の責務位置を特定する
  - extract2 の tileId 索引と vectortile 入力生成の整合を実装する
  - ノード削除時の tileIdToBufferRelations クリーンアップを確認する
  - 修正方針を決めて最小差分で実装する
  - 再開時に進捗とペインが安定することを確認する
  - ズームレンジの分割UI（n分割＋ブレークポイント指定）を実装する
  - ズーム範囲セットに基づく extract2 タスク生成と tolerance スケールを実装する
  - TopoJSON版の extract2/vectortile を z0/z1-4/z5-9 集約方針で再構築する
  - Step4でタイルBBox拡張係数/マージンを設定できるようにする
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 11:51 JST shape-plugin のバッチ再開時に進捗が更新されない問題の調査に着手。
  - done: 2026-01-04 13:02 JST extract2 の tileId 索引と shape-ephemeral の tileIdToBufferRelations を追加し、vectortile 入力生成を tileId 参照へ更新。ノード削除/ステージ削除で索引をクリーンアップするよう反映。検証: 未実施。
  - done: 2026-01-04 13:43 JST download を chunk-store（flatgeobuf+gzip）へ保存し、extract1 は chunk-store を優先して読み込むよう更新。vectortile は tileId 関係を使って該当 buffer だけ読み込み、assembleTileGeoJSON でタイルBBoxにクリップして生成。検証: 未実施。
  - start: 2026-01-04 14:12 JST ズームレンジ分割UIの実装（n分割 + ブレークポイントスライダー）に着手。
  - done: 2026-01-04 14:25 JST ズームレンジ分割UI（range 0-12 + n分割 + n+1ブレークポイント）と共有設定の保存/読み込み、ラベル文言更新を反映。検証: 未実施。
  - start: 2026-01-04 14:40 JST ズーム範囲セット別の extract2 タスク生成とズーム連動単純化の実装に着手。
  - done: 2026-01-04 15:20 JST extract2 をズーム範囲セットごとに多重化し、tolerance をズーム上限でスケールする入力を付与。taskId に zoomRangeLabel を付け、per-task input を優先するよう adapter を更新。検証: 未実施。
  - start: 2026-01-04 15:35 JST TopoJSON版の extract2/vectortile を z0/z1-4/z5-9 集約方針で再構築し、Step4で拡張係数/マージン設定を追加する作業に着手。
  - done: 2026-01-04 16:35 JST TopoJSON版の extract2 をズーム分割（z0/z1-4/z5+）でグループ化し、tile拡張係数/マージンを導入。TopoJSON抽出のタイル依存ロジックを廃止し、tile生成時にfeatureId重複を除外。検証: 未実施。
  - start: 2026-01-04 17:10 JST Toolbar 設定メニューの share zoom range に分割スライダーを配置する作業に着手。
  - done: 2026-01-04 17:20 JST Toolbar 設定メニューの share zoom range に分割スライダー（分割数/ブレークポイント）を追加し、共有設定の保存形式を range+segments+breakpoints に統一。route-plugin の共有ズーム読み込みも新形式対応。検証: 未実施。
  - done: 2026-01-04 17:35 JST Step5 の Next 判定を processingStatus 完了で許可し、vectortile の保存確認を TilesDB（+ legacy shapeDB）参照に更新。検証: 未実施。
  - start: 2026-01-04 18:05 JST vectortile 保存先を shape/location/route DB へ戻し、共通スーパークラスへ VectorTileDB2 由来機能と metadata テーブルを集約、vectortile-store 廃止の対応に着手。
  - start: 2026-01-04 18:45 JST vectortile-store を維持しつつ nodeId を NodeId へ具体化するリファクタリングに着手。
  - done: 2026-01-04 19:30 JST vectortile-store を共通ベース（VectorTileDbBase/metadata）として維持し、vector-tile-db を撤去。runtime-worker/gis-sdk/shape・route・location で import/依存を vectortile-store へ統一し、vectortile API の nodeId を NodeId 型へ更新。検証: 未実施。

2051) fix/shape-plugin/auth-dialog-buttons (P2) — 進行中 (2026-01-09)
- ブランチ名: fix/shape-plugin/auth-dialog-buttons
- 依存: なし
- 受け入れ基準: shape-plugin の認証要求ダイアログで Cancel が「Cancel (Back to Step 2)」表記になり押しやすいサイズになる／Microsoft ボタンが disabled 表示でクリック不可になる／3つの認証プロバイダボタン群が中央揃えになる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src`（認証要求ダイアログ周辺）
- ロールバック手順: shape-plugin の UI 変更差分を revert して元のボタン表示/配置へ戻す
- チェックリスト:
  - Cancel ラベルとサイズ調整の対象コンポーネントを特定する
  - Microsoft ボタンを disabled に戻す
  - 認証プロバイダボタン群を中央揃えにする
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 00:00 JST shape-plugin 認証ダイアログの UI 調整に着手。
  - done: 2026-01-09 00:06 JST Cancel ラベル/サイズ調整、Microsoft 無効化、プロバイダボタン中央揃えを反映。検証: 未実施。
  - done: 2026-01-09 00:10 JST Cancel (Back to Step 2) 押下時の確認ダイアログをスキップするよう変更。検証: 未実施。
  - start: 2026-01-09 00:15 JST 認証後の return URL 破損（/auth/callback/http:/...）修正に着手。
  - done: 2026-01-09 00:19 JST 認証コールバックで絶対URLを正規化し、同一オリジンはpathで遷移、外部はlocation.assignに分岐。検証: 未実施。
  - done: 2026-01-09 00:23 JST Availability 表示を削除し、リロードボタンのツールチップにダウンロード時刻を表示。検証: 未実施。
  - done: 2026-01-09 00:28 JST GeoBoundaries の availability URL を gbOpen/available に修正し、テストのモックURLも更新。検証: 未実施。
  - done: 2026-01-09 00:42 JST 大陸フォールバックを N/A に変更し、GeoBoundaries メタデータの欠落時は ISO3166 ロケーションから補完。検証: 未実施。
  - done: 2026-01-09 00:50 JST GeoBoundaries/GADM の大陸欠落・齟齬を ISO3166 由来の値と突き合わせて warn を出すよう追加。検証: 未実施。
  - done: 2026-01-09 00:55 JST vector tile 用の DexieChunkStore を auth 無効化して FetchNetworkPort の scope エラーを回避。検証: 未実施。

2043) fix/runtime-worker/export-create-node-payload-peer-store (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/runtime-worker/export-create-node-payload-peer-store
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の dist/index.d.ts から createNodePayloadPeerStore が export される／plugins/spreadsheet-plugin のビルドで MISSING_EXPORT が解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src` と `plugins/spreadsheet-plugin`
- ロールバック手順: runtime-worker の export 差分を revert し、必要なら spreadsheet-plugin の import を元に戻す
- チェックリスト:
  - createNodePayloadPeerStore の定義と export 経路を特定する
  - index.ts / package exports / types の整合を修正する
  - spreadsheet-plugin の import が runtime-worker の public API に一致することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:41 JST runtime-worker の export 不整合修正に着手。
  - done: 2026-01-03 23:45 JST spreadsheet-plugin の dist/worker.js と map の旧PeerStore import を削除。検証: 未実施。

2044) fix/chunk-store/download-exports (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/chunk-store/download-exports
- 依存: なし
- 受け入れ基準: @hierarchidb/chunk-store の build:types/typecheck で NetworkPort/Storage* の export エラーが解消する／@hierarchidb/download 側の公開APIと参照が一致する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/chunk-store/src` と `packages/features/download/src`
- ロールバック手順: chunk-store と download の export/import 差分を revert して元の参照へ戻す
- チェックリスト:
  - chunk-store の import 参照元を特定する
  - download の export を確認し必要に応じて修正する
  - build:types/typecheck エラーが消えることを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:49 JST chunk-store の download export 不整合修正に着手。
  - done: 2026-01-03 23:50 JST download の index.ts から ports 型定義を export。検証: 未実施。

2045) fix/gis-sdk/featurecollection-like-typecheck (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/gis-sdk/featurecollection-like-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/gis-sdk の typecheck で TS2345 が解消する／FeatureCollectionLike と GeoJSON FeatureCollection の型整合が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/vectorTiles.ts`
- ロールバック手順: gis-sdk の型/変換変更を revert して元のキャストに戻す
- チェックリスト:
  - TS2345 の発生箇所と型定義を確認する
  - FeatureCollectionLike の変換を明示して型エラーを解消する
  - typecheck で再発しないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:52 JST gis-sdk の FeatureCollectionLike 型エラー修正に着手。
  - done: 2026-01-03 23:54 JST FeatureCollectionLike を GeoJSON 型に合わせ、serialize 入力の型整合を修正。検証: 未実施。
  - done: 2026-01-03 23:55 JST GeometryCollection を除外して座標アクセスの型エラーを解消。検証: 未実施。

2046) fix/runtime-worker/nodeid-typecheck (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/runtime-worker/nodeid-typecheck
- 依存: なし
- 受け入れ基準: @hierarchidb/runtime-worker の typecheck で TS2322 が解消する／NodeId の型整合が保たれる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts`
- ロールバック手順: NodeId 型整合の修正差分を revert して元の実装に戻す
- チェックリスト:
  - NodeId 型エラー箇所を特定する
  - string と NodeId の整合を取る
  - typecheck の再発がないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:56 JST runtime-worker の NodeId 型エラー修正に着手。
  - done: 2026-01-03 23:56 JST targetNodeId を NodeId にキャストし型エラーを解消。検証: 未実施。

2047) fix/route-plugin/vector-tile-input-types (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/route-plugin/vector-tile-input-types
- 依存: なし
- 受け入れ基準: route-plugin の typecheck で inputFormat/inputCompression の型エラーが解消する／runtime-worker の VectorTileStageInput と writeVectorTileInput の型が一致する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/vectorTileStageRunner.ts` と `plugins/route-plugin/src/services/*`
- ロールバック手順: vector tile 入力型の変更差分を revert して元の型定義に戻す
- チェックリスト:
  - route-plugin の型エラー箇所を特定する
  - runtime-worker の型定義と一致させる
  - typecheck の再発がないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:57 JST route-plugin の vector tile 入力型エラー修正に着手。
  - done: 2026-01-03 23:58 JST runtime-worker の VectorTileStageInput に inputFormat/inputCompression を追加。検証: 未実施。
  - done: 2026-01-03 23:58 JST 検証: pnpm --filter @hierarchidb/runtime-worker build / pnpm --filter @hierarchidb/route-plugin typecheck を実行（build は warn あり）。

2048) fix/app-build/vite-config-package-json (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/vite-config-package-json
- 依存: なし
- 受け入れ基準: @hierarchidb/app の build で vite.config.ts が packages/app/package.json を参照しないよう修正し、ENOENT を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/vite.config.ts`（必要に応じて関連設定）
- ロールバック手順: vite config の差分を revert して元の参照に戻す
- チェックリスト:
  - vite.config.ts の package.json 参照箇所を特定する
  - 参照パスを正しい位置へ修正する
  - build エラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:03 JST app build の package.json 参照エラー修正に着手。
  - done: 2026-01-04 00:04 JST plugin-registry の repoRoot 解決を修正し app/package.json 参照を正しい場所に変更。検証: 未実施。
  - done: 2026-01-04 00:06 JST pnpm-workspace.yaml を基準に repoRoot を検出するよう修正。検証: 未実施。

2049) fix/app-build/missing-common-exports (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/missing-common-exports
- 依存: なし
- 受け入れ基準: @hierarchidb/app build で common-types/common-api の Missing export エラーが解消する／runtime-worker と common-* の公開API整合が取れる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/common/types` と `packages/common/api`（必要に応じて runtime-worker）
- ロールバック手順: common-* の export 差分を revert して元の公開APIに戻す
- チェックリスト:
  - Missing export の実体と export 経路を特定する
  - common-* の dist/public API を整合させる
  - app build の Missing export が解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:07 JST app build の common-* Missing export 修正に着手。
  - done: 2026-01-04 00:10 JST common-types/common-api に型プレースホルダを追加。検証: pnpm --filter @hierarchidb/common-types build / pnpm --filter @hierarchidb/common-api build（warn あり）。

2050) fix/app-build/remove-dexie-shim (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app-build/remove-dexie-shim
- 依存: なし
- 受け入れ基準: `app/src/shims/dexie-export-shim.ts` を削除し、vite の dexie alias を元に戻す／shim 追加ポリシーに抵触しない状態に戻る／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/vite.config.ts` と `app/src/shims/dexie-export-shim.ts`
- ロールバック手順: dexie shim の削除差分を revert して元の alias/ファイルを戻す
- チェックリスト:
  - dexie shim ファイルを削除する
  - vite config の dexie alias を元に戻す
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:28 JST dexie shim の削除に着手。
  - done: 2026-01-04 00:29 JST dexie shim を削除し、vite alias を元に戻した。検証: 未実施。

2051) fix/ui-map/selection-gesture-undefined (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/ui-map/selection-gesture-undefined
- 依存: なし
- 受け入れ基準: `@hierarchidb/ui-map` の typecheck で TS2322 が解消する／`onSelectionChange` の挙動が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src/preview/useMapFeatureSelectionGestures.ts`
- ロールバック手順: 変更差分を revert して元の選択処理に戻す
- チェックリスト:
  - entries[0] が undefined の場合の取り扱いを整理する
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:33 JST ui-map selection gesture の型エラー修正に着手。
  - done: 2026-01-04 00:34 JST entries[0] の null チェックを追加し TS2322 を回避。検証: 未実施。

2052) fix/runtime-worker/shape-batch-session-types (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/runtime-worker/shape-batch-session-types
- 依存: なし
- 受け入れ基準: `@hierarchidb/runtime-worker` の typecheck で ShapeMutationService/ShapeQueryService の TS2345/TS2352 が解消する／BatchSessionRecord と ShapeBatchSessionRecord の型整合が取れる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeMutationService.ts` と `packages/runtime-worker/src/services/ShapeQueryService.ts`（必要に応じて関連型）
- ロールバック手順: 変更差分を revert して元の型定義へ戻す
- チェックリスト:
  - ShapeMutationService/ShapeQueryService の型エラー箇所を特定する
  - BatchSessionRecord/ShapeBatchSessionRecord の整合を取る
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 00:40 JST runtime-worker の shape batch session 型エラー修正に着手。
  - done: 2026-01-04 00:44 JST ShapeMutationService/ShapeQueryService で batch session/vector tile の型変換を追加。検証: 未実施。
  - done: 2026-01-04 00:47 JST ResourceUsage などの型変換に unknown 経由のキャストを追加。検証: 未実施。
  - done: 2026-01-04 00:55 JST unknown キャストを撤去し、型ガード/明示的変換で BatchSessionRecord を構築。検証: 未実施。
  - done: 2026-01-04 01:02 JST currentStage の許容値へ正規化して型エラーを解消。検証: 未実施。

2053) fix/shape-plugin/batch-session-types (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/shape-plugin/batch-session-types
- 依存: なし
- 受け入れ基準: `@hierarchidb/shape-plugin` の typecheck で batch session/vector tile/geometry/NodeId 関連の型エラーが解消する／plugin-service-api と shape-store の型境界が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/*` と `plugins/shape-plugin/src/services/tiles/VectorTileService.ts`、`plugins/shape-plugin/src/ui/components/steps-provider.tsx`、`plugins/shape-plugin/src/worker/api.ts`
- ロールバック手順: 変更差分を revert して元の型定義へ戻す
- チェックリスト:
  - batch session の型変換経路を整理する
  - vector tile/geometry/NodeId の型エラーを解消する
  - typecheck のエラーが解消することを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 01:12 JST shape-plugin の型エラー修正に着手。
  - done: 2026-01-04 01:24 JST shape batch session/vector tile の変換ヘルパーを追加し、関連箇所へ適用。検証: 未実施。
  - done: 2026-01-04 01:30 JST VectorTileService の geometry 判定を Record ベースで安全化。検証: 未実施。

2054) fix/app/modeless-dialog-type (P1) — 進行中 (2026-01-04)
- ブランチ名: fix/app/modeless-dialog-type
- 依存: なし
- 受け入れ基準: `app/src/router/routes/modeless/modelessDialogContent.tsx` の TS2339 が解消する／`type` の参照元の型が明確になる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/router/routes/modeless/modelessDialogContent.tsx`
- ロールバック手順: 変更差分を revert して元の型参照に戻す
- チェックリスト:
  - `type` を参照している値の型を特定する
  - TypeScript の型エラーを解消する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-04 01:34 JST modelessDialogContent の型エラー修正に着手。
  - done: 2026-01-04 01:39 JST geometry.type 参照を型ガード経由に変更。検証: 未実施。

2042) fix/shape-store/tsconfig-paths (P1) — 進行中 (2026-01-03)
- ブランチ名: fix/shape-store/tsconfig-paths
- 依存: なし
- 受け入れ基準: @hierarchidb/shape-store の tsconfig にある baseUrl/paths のローカル上書きを撤去し、paths を { "~/*": ["./src/*"] } のみにする／@hierarchidb/shape-store の build:types で TS2307/TS2339 を解消する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/shape-store/tsconfig.json` と `packages/features/shape-store/src/EphemeralShapeDB.ts`
- ロールバック手順: `packages/shape-store/tsconfig*.json` と `packages/features/shape-store/src/EphemeralShapeDB.ts` の差分を revert してローカル上書き・型修正を元に戻す
- チェックリスト:
  - shape-store の tsconfig の baseUrl/paths 上書きを特定する
  - paths を { "~/*": ["./src/*"] } のみに揃える
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-03 23:00 JST shape-store の tsconfig paths 警告修正に着手。
  - done: 2026-01-03 23:00 JST shape-store の tsconfig paths を "~/*" のみに整理。検証: 未実施。
  - start: 2026-01-03 23:46 JST shape-store build:types の TS2307/TS2339 修正に着手。
  - done: 2026-01-03 23:48 JST shape-store に @hierarchidb/gis-sdk 依存を追加し解決策を反映。検証: 未実施。

2040) refactor/app/treeconsole-actions-split (P2) — 完了 (2026-01-09)
- ブランチ名: refactor/app/treeconsole-actions-split
- 依存: なし
- 受け入れ基準: app/src/hooks/treeconsole/createTreeConsoleActions.ts を責務ごとに分割し、API/挙動を維持する／分割後の import/export が TypeScript で通る状態にする／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `app/src/hooks/treeconsole/createTreeConsoleActions.ts` と `app/src/hooks/treeconsole/actions/*`
- ロールバック手順: `app/src/hooks/treeconsole/createTreeConsoleActions.ts` と `app/src/hooks/treeconsole/actions/*` の差分を revert して分割前の単一ファイルへ戻す
- チェックリスト:
  - createTreeConsoleActions の責務を分割ファイルへ移動する
  - 呼び出し側の API を維持する
  - 影響範囲/ロールバック/運用ログを追記する
- 運用ログ：
  - start: 2026-01-09 10:06 JST TreeConsole actions 分割の実装に着手。
  - done: 2026-01-09 10:28 JST TreeConsole actions を actions 配下へ分割し、createTreeConsoleActions を配線のみへ整理。検証: 未実施。

2042) fix/gis-sdk/vector-tiles-empty-result (P2) — 完了 (2026-01-09)
- ブランチ名: fix/gis-sdk/vector-tiles-empty-result
- 依存: なし
- 受け入れ基準: VectorTileGenerateResult の空ケースで tiles を必ず返す／typecheck エラーが消える／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/features/gis-sdk/src/vectorTiles.ts`
- ロールバック手順: `packages/features/gis-sdk/src/vectorTiles.ts` の差分を revert する
- チェックリスト:
  - 空ケースの戻り値に tiles を追加する
  - typecheck エラーが消えることを確認する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:44 JST VectorTileGenerateResult の空結果修正に着手。
  - done: 2026-01-09 10:45 JST 空結果で tiles 配列を返すよう統一し型エラーを解消。検証: 未実施。

2043) fix/runtime-worker/typecheck-commandresult-and-shape-db (P2) — 完了 (2026-01-09)
- ブランチ名: fix/runtime-worker/typecheck-commandresult-and-shape-db
- 依存: なし
- 受け入れ基準: CommandResult を正しく re-export し typecheck エラーを解消する／StageProcessingService の型変換警告を解消する／ShapeDB のハンドル型が ShapeDatabaseLike を満たす／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/command-types.ts`, `packages/runtime-worker/src/services/command-types.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/WorkerService.ts`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - CommandResult の re-export を追加する
  - StageProcessingService の unsafe cast を明示的に解消する
  - ShapeDatabaseHandle の型を ShapeDatabaseLike に合わせる
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:52 JST runtime-worker typecheck エラー修正に着手。
  - done: 2026-01-09 10:56 JST CommandResult の re-export 追加、StageProcessingService の cast を明示化、ShapeDatabaseHandle に metadata テーブルを追加。検証: 未実施。

2044) refactor/runtime-worker/shape-db-concrete-types (P2) — 完了 (2026-01-09)
- ブランチ名: refactor/runtime-worker/shape-db-concrete-types
- 依存: なし
- 受け入れ基準: ShapeDatabaseLike/ShapeDatabaseHandle を撤去し ShapeDB 型を直接使う／StageProcessingService の Record<string, unknown> キャストを撤去する／挙動は変更しない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/runtime-worker/src/services/ShapeMutationService.ts`, `packages/runtime-worker/src/services/ShapeQueryService.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/WorkerService.ts`
- ロールバック手順: 上記ファイルの差分を revert し、旧来の ShapeDatabaseLike/ShapeDatabaseHandle/Record キャストに戻す
- チェックリスト:
  - ShapeDatabaseLike/ShapeDatabaseHandle を撤去する
  - Record<string, unknown> のキャストを削除する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 11:10 JST ShapeDB 型の直接利用と Record キャスト撤去に着手。
  - done: 2026-01-09 11:15 JST ShapeDB へ置換し、VectorTile アイテム型を明示して Record キャストを撤去。検証: 未実施。

2045) fix/shape-plugin/typecheck-batch-and-tiles (P2) — 完了 (2026-01-09)
- ブランチ名: fix/shape-plugin/typecheck-batch-and-tiles
- 依存: なし
- 受け入れ基準: shape-plugin の typecheck エラー（BatchTaskBase/zoomRanges/GeoJSON/NodeId/VectorTileDB2Procedure）を解消する／挙動は維持する／抽象化や Record キャストの追加をしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/common/types/build.ts`, `plugins/shape-plugin/src/services/batch/session/extract2/zoomRanges.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/assembleTileGeoJSON.ts`, `plugins/shape-plugin/src/services/batch/ShapeBuildAPIClient.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/VectorTileDB2Procedure.ts`, `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/package.json`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - BatchTaskBase の stage/type を埋める
  - zoomRanges と VTConfigSection の undefined を解消する
  - GeoJSON 判定と NodeId 型を整える
  - VectorTileDB2Procedure の型と依存を整理する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 11:24 JST shape-plugin typecheck エラー修正に着手。
  - done: 2026-01-09 11:39 JST BatchTaskBase の stage/type 付与、zoom/NodeId/GeoJSON の型修正、VectorTileDB2Procedure の依存と型を整理。検証: 未実施。
  - done: 2026-01-09 11:44 JST tsconfig.base.json の vectortile-store path を dist に修正（dependency-guard 対応）。検証: 未実施。
  - done: 2026-01-09 12:03 JST assembleTileGeoJSON の geometry ガード強化と VectorTileDB2Procedure の bbox 入力型ガードを追加。検証: 未実施。

2041) fix/ui-map/full-map-display-mapstyle-undefined (P2) — 完了 (2026-01-09)
- ブランチ名: fix/ui-map/full-map-display-mapstyle-undefined
- 依存: なし
- 受け入れ基準: FullMapDisplay が mapStyleObject の undefined を渡さず typecheck を通す／挙動を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/ui/map/src/components/FullMapDisplay.tsx`
- ロールバック手順: `packages/ui/map/src/components/FullMapDisplay.tsx` の差分を revert する
- チェックリスト:
  - mapStyleObject の undefined を解消する
  - typecheck エラーが消えることを確認する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-09 10:34 JST FullMapDisplay の mapStyleObject 型エラー修正に着手。
  - done: 2026-01-09 10:38 JST FullMapDisplay の props 定義を style URL/obj の union へ整理し、mapStyleObject の undefined を排除。検証: 未実施。

2037) chore/analysis/list-large-ts-files (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/list-large-ts-files
- 依存: なし
- 受け入れ基準: app/src・packages/**/src・plugins/*/src の TypeScript/TSX で1000行以上のファイルを列挙する／ファイルパスと行数を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 対象パス配下の .ts/.tsx を行数カウントする
  - 1000行以上のファイル一覧を作成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:18 JST 1000行以上のTS/TSXファイル一覧作成に着手。
  - done: 2026-01-03 21:19 JST app/src・packages/**/src・plugins/*/src の1000行以上ファイルを列挙。コマンド: python3 - <<'PY' ... で行数集計。

2039) chore/analysis/split-map-routes-proposal (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/split-map-routes-proposal
- 依存: なし
- 受け入れ基準: app/src/router/routes/map.tsx の現状責務を整理する／責務単位で分割候補ファイルと役割を提示する／ルーティング構造と依存関係への影響（import/export観点）を簡潔に示す／TASKS.md に運用ログを記載する
- チェックリスト:
  - map.tsx の現状責務を箇条書きで整理する
  - 責務ごとの分割候補ファイル名と配置案を示す
  - ルーティング構造と依存関係への影響をまとめる
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:24 JST map.tsx 分割提案の調査に着手。
  - done: 2026-01-03 21:24 JST map.tsx の責務整理と分割提案を提示。

2040) refactor/ui/split-map-routes (P2) — 完了 (2026-01-03)
- ブランチ名: refactor/ui/split-map-routes
- 依存: なし
- 受け入れ基準: app/src/router/routes/map.tsx を MapPage + hooks + UI コンポーネントへ分割する／URL同期・検索・ハイライト・レイヤー構築の挙動を維持する／循環依存がないことを確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - map ルートのエントリを薄くし MapPage を分離する
  - hooks（view state/search/highlight/folder layers）を抽出する
  - SearchPanel/SearchSettingsDialog を分離する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:24 JST map.tsx の分割実装に着手。
  - done: 2026-01-03 21:34 JST MapPage/hooks/検索UIへ分割し、map.tsx を薄いエントリに変更。

2041) refactor/ui-map/extract-map-preview-parts (P2) — 完了 (2026-01-04)
- ブランチ名: refactor/ui-map/extract-map-preview-parts
- 依存: なし
- 受け入れ基準: app/src/router/routes/map* の再利用性が高い preview 部品（検索UI/検索ロジック/ハイライト等）を ui-map に移設する／呼び出し側を ui-map の新部品に置換する／挙動が維持されることを確認する／TASKS.md に運用ログを記載する
- チェックリスト:
  - map* から移設対象コンポーネント/フックを抽出する
  - ui-map に移設し exports を追加する
  - app 側を ui-map の部品に差し替える
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 19:14 JST map preview 部品の ui-map 移設に着手。
  - done: 2026-01-04 19:21 JST search UI と検索/ハイライト hook を ui-map に移設し、app 側を置換。

2042) feat/ui-map/preview-selection-gestures (P1) — 完了 (2026-01-04)
- ブランチ名: feat/ui-map/preview-selection-gestures
- 依存: なし
- 受け入れ基準: Meta/Shift クリックと背景クリック、Meta+ドラッグの矩形選択を実装し、Jotai の選択Setへ反映される／Snackbar をオプションで有効化でき、近傍メタデータを表示できる／/map 既存機能を破壊しない／TASKS.md に運用ログを記載する
- チェックリスト:
  - 選択Set/hoverSet を Jotai へ整理し、既存利用箇所を移行する
  - クリック/ドラッグの入力判定を実装する
  - Snackbar 表示オプションと表示内容ビルダを追加する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 22:05 JST preview 選択ジェスチャと Snackbar の実装に着手。
  - done: 2026-01-04 22:20 JST クリック/ドラッグ選択と hover Snackbar を ui-map に追加し /map を更新。

2043) feat/ui-map/styler-toggle-dialog (P1) — 完了 (2026-01-04)
- ブランチ名: feat/ui-map/styler-toggle-dialog
- 依存: なし
- 受け入れ基準: styler ノード由来のスタイル一覧を ModelessDialog で表示し、チェックボックスでオン/オフできる／スタイルの切替が地図に反映される／TASKS.md に運用ログを記載する
- チェックリスト:
  - styler の一覧と詳細情報（パス/説明/データソース/フィルタ/カラーチャート）を用意する
  - ModelessDialog へ専用のスタイル一覧を追加する
  - トグル状態を地図描画へ反映する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-04 22:20 JST styler 一覧ダイアログの実装に着手。
  - done: 2026-01-04 23:07 JST スタイル一覧とトグルを追加し地図描画へ反映。

2038) chore/analysis/gen-plugin-registry-split-proposal (P3) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/gen-plugin-registry-split-proposal
- 依存: なし
- 受け入れ基準: gen-plugin-registry.ts の責務を分解し、具体的な分割案（ファイル名と役割）を提案する／依存関係と公開インターフェース整理方針を示す／段階的な移行手順を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 現行ファイルの責務と構成を把握する
  - 分割単位とファイル名の提案を作成する
  - 依存関係と公開インターフェースの整理方針を示す
  - 段階的な移行手順を提案する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:22 JST gen-plugin-registry.ts 分割提案の調査に着手。
  - done: 2026-01-03 21:24 JST 現行責務の分解と分割案・移行手順を提示。

2039) refactor/tools/gen-plugin-registry-split (P2) — 完了 (2026-01-03)
- ブランチ名: refactor/tools/gen-plugin-registry-split
- 依存: なし
- 受け入れ基準: gen-plugin-registry.ts を責務ごとに分割し、挙動が変わらない／plugin-registry 配下に整理しエントリは薄く保つ／生成結果に変更がないことを確認または未検証理由を明記する／TASKS.md に運用ログと影響範囲を記載する
- チェックリスト:
  - 定数/ユーティリティ/収集/生成/検証の各モジュールを分割する
  - gen-plugin-registry.ts を orchestrator へ整理する
  - 生成結果の差分有無を確認し記録する
  - 運用ログ start/done/blocked と影響範囲を追記する
- 運用ログ：
  - start: 2026-01-03 21:26 JST gen-plugin-registry.ts の分割作業に着手。
  - done: 2026-01-03 21:31 JST plugin-registry 配下へ責務分割しエントリを薄く整理。検証: 未実施（生成コマンド未実行）。
- 影響範囲：`packages/tools/build-scripts/src/gen-plugin-registry.ts` と `packages/tools/build-scripts/src/plugin-registry/*`

2040) chore/analysis/list-large-ts-files-refresh (P3) — 進行中 (2026-01-03)
- ブランチ名: chore/analysis/list-large-ts-files-refresh
- 依存: なし
- 受け入れ基準: app/src・packages/**/src・plugins/*/src の TypeScript/TSX で1000行以上のファイルを再列挙する／ファイルパスと行数を提示する／TASKS.md に運用ログを記載する
- チェックリスト:
  - 対象パス配下の .ts/.tsx を行数カウントする
  - 1000行以上のファイル一覧を再作成する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 21:50 JST 1000行以上のTS/TSXファイル再集計に着手。
  - done: 2026-01-03 21:50 JST 再集計を実行。コマンド: python3 - <<'PY' ... で行数集計。

2041) refactor/ui/split-use-tree-view-controller-tests (P2) — 進行中 (2026-01-03)
- ブランチ名: refactor/ui/split-use-tree-view-controller-tests
- 依存: なし
- 受け入れ基準: useTreeViewController.test.tsx のテストを内容ごとに分割し複数ファイルに移す／テスト挙動は変更しない／テスト検出に影響がないこと／TASKS.md に運用ログと影響範囲を記載する
- チェックリスト:
  - テスト内容のカテゴリを整理する
  - 分割先ファイルにテストを移動する
  - 旧ファイルを整理または削除する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 22:16 JST useTreeViewController.test.tsx の分割作業に着手。
  - done: 2026-01-03 22:23 JST テストを内容別に分割し複数ファイルへ移動。検証: 未実施。
- 影響範囲：`packages/ui/treeconsole/base/src/hooks/useTreeViewController*.test.tsx`

2036) feat/gis-sdk/flatgeobuf-input (P2) — 完了 (2026-01-09)
- ブランチ名: feat/gis-sdk/flatgeobuf-input
- 依存: なし
- 受け入れ基準: gis-sdk が FlatGeobuf 入力から vector tile 生成できる／VectorTileGenerateConfig に入力フォーマット指定を追加する／runtime-worker の呼び出し側が新しい入力フォーマット指定を受け取れる／既存JSONフローの互換性を維持する／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：gis-sdk に FlatGeobuf buffer のデコードを追加し、vector tile 生成を入力フォーマットで分岐できるよう拡張。runtime-worker は inputFormat を受け取り flatgeobuf 時に新経路を使用する。
- 影響範囲：`packages/features/gis-sdk/src/vectorTiles.ts` と `packages/runtime-worker/src/services/StageProcessingService.ts` の入力処理、`packages/runtime-worker/src/types.ts` の API 型、`packages/features/gis-sdk/package.json` の依存。
- ロールバック手順：上記ファイルの差分を revert し、`flatgeobuf` 依存追加と新規デコード関数を取り除く。
- チェックリスト:
  - FlatGeobuf buffer から FeatureCollection を生成する処理を追加する
  - FlatGeobuf 用の generate 関数と export を追加する
  - VectorTileGenerateConfig / worker API に入力フォーマットを追加する
  - 既存JSONフローが変わらないことを確認する
  - 運用ログ start/done/blocked と影響範囲/ロールバックを追記する
- 運用ログ：
  - start: 2026-01-09 02:26 JST FlatGeobuf 入力対応の実装に着手。
  - done: 2026-01-09 02:31 JST FlatGeobuf 入力の生成関数と runtime-worker 分岐を追加。

2035) chore/analysis/route-vector-tile-flatgeobuf (P2) — 完了 (2026-01-09)
- ブランチ名: chore/analysis/route-vector-tile-flatgeobuf
- 依存: なし
- 受け入れ基準: ルートベクタタイル生成の入力JSON構造と利用箇所を整理する／FlatGeobuf化の適用ポイントを2案以上で比較する／性能改善の見込みと移行リスクを簡潔に整理する／TASKS.md に運用ログを追記する
- 要点：入力は GeoJSON FeatureCollection（Route=LineString、Location=Point）で、Dexie chunk store に sessionId/nodeId キーで保存。FlatGeobuf への移行は「保存形式のみ置換」か「入力フォーマット分岐の追加」で段階対応でき、JSON.parse コスト削減が見込めるが geojson-vt 前処理がボトルネックとして残る。
- チェックリスト:
  - JSON入力の利用箇所とデータ構造を整理する
  - FlatGeobuf化の適用案を比較する
  - 性能改善の見込みと移行リスクを整理する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-09 02:10 JST FlatGeobuf 化の検討調査に着手。
  - done: 2026-01-09 02:24 JST JSON入力構造とFlatGeobuf適用案を整理し、性能/リスク観点をまとめた。

2034) refactor/shape/metadata-download-migration (P1) — 完了 (2026-01-03)
- ブランチ名: refactor/shape/metadata-download-migration
- 依存: 2030
- ExecPlan: plans/shape-metadata-download-migration-execplan.md
- 受け入れ基準: @hierarchidb/fetch-save-metadata を削除する／shape-plugin Step3 が @hierarchidb/download 経由で geoBoundaries API からメタデータを取得・キャッシュし表示できる／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：Step3 の国メタデータ取得を download 経由へ統合し、geoBoundaries/GADM/Natural Earth の取得・解析を実装。openstreetmap は Step2 無効化と Step3 例外で遮断。fetch-save-metadata と関連スクリプト/alias を削除した。
- 原因/影響範囲：静的 JSON 再配布の fetch-save-metadata に依存していたためデータ鮮度と iso2 欠落が問題化。影響範囲は shape-plugin Step3（UI/Worker）と download パッケージの API、ビルド前処理と tsconfig/vite alias。
- 修正内容と適用範囲：downloadText を追加し条件付きキャッシュ対応。MetadataLoader を download 経由に差し替え、geoBoundaries は `gbOpen/ALL/ALL` から iso3+level を集計、GADM は maps.html と各国ページから level 表記を抽出、Natural Earth は worldwide 1 行に固定。openstreetmap は Step3 で例外。fetch-save-metadata を削除し、`package.json` の metadata:ensure 系、`app/vite.config*.ts`、`tsconfig.base.json`、`types/ambient-modules.d.ts` を整理。対象: `packages/features/download/src/pluginDownloadRegistry.ts`, `plugins/shape-plugin/src/services/metadata/metadataSources.ts`, `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`, `plugins/shape-plugin/src/ui/hooks/useCountryMetadata.ts`, `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/src/ui/hooks/useShapeDataSourceStep.ts`, `plugins/shape-plugin/src/common/mock/data.ts`, `plugins/shape-plugin/src/common/__tests__/unit/metadata-loader.unit.test.ts`, `plugins/shape-plugin/src/services/utils/__tests__/generateUrlMetadata.unit.test.ts` ほか。
- 検証：未実施（手動/自動テスト未実行）。
- ロールバック手順：上記ファイル群の差分を revertし、`packages/features/fetch-save-metadata` と `scripts/data-generation/generate-metadata.mjs` を復元。`package.json` の metadata:ensure 系と vite/tsconfig/ambient module の alias を元に戻す。
- チェックリスト:
  - fetch-save-metadata 依存と import を排除する
  - geoBoundaries metadata を downloadJson で取得し、CountryMetadata に変換する
  - Step3 の UI/Worker が新しいメタデータ経路で動作する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-03 17:36 JST fetch-save-metadata 削除と metadata download 移行に着手。
  - done: 2026-01-03 18:22 JST downloadText 追加と metadata 取得移行、fetch-save-metadata 削除を完了。

2035) feat/vector-tiles/chunkstore-input-formats (P1) — 進行中 (2026-01-03)
- ブランチ名: feat/vector-tiles/chunkstore-input-formats
- 依存: なし
- ExecPlan: plans/vector-tiles-chunkstore-input-formats-execplan.md
- 受け入れ基準: shape/location/route のベクトルタイル生成で chunk-store の素材保存形式を geojson/geojson+gzip/flatgeobuf/flatgeobuf+gzip から選べる／保存と読み出しが形式ごとに動作する／既存の geojson 既定動作が維持される／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 要点：runtime-worker の chunk-store 入力に inputFormat/inputCompression を追加し gzip 圧縮/解凍を実装。gis-sdk に FlatGeobuf エンコードを追加し、shape/location/route の入力生成と config 配線を更新。RouteVectorTileService は writeVectorTileInput 経由で chunk-store 書き込みを共通化。
- 影響範囲：`packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/types.ts`, `packages/features/gis-sdk/src/vectorTiles.ts`, `packages/features/gis-sdk/src/index.ts`, `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, `plugins/shape-plugin/src/common/types/ObsolateBuildConfig.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/vectorTileTasks.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/features/location-store/src/index.ts`, `plugins/location-plugin/src/services/batch/LocationSessionController.ts`, `plugins/location-plugin/package.json`, `packages/features/route-store/src/index.ts`, `plugins/route-plugin/src/services/RouteBatchSession.ts`, `plugins/route-plugin/src/services/RouteVectorTileService.ts`, `plugins/route-plugin/package.json`, `vitest.setup.base.ts`。
- 検証：未実施（手動/自動テスト未実行）。
- ロールバック手順：上記ファイルの差分を revert し、chunk-store 入力を JSON のみに戻す。route は DexieChunkStore 直接書き込みへ戻し、inputFormat/inputCompression の追加型定義を削除する。
- チェックリスト:
  - 現状の素材保存パイプラインとフォーマット処理を特定する
  - 入力フォーマット拡張（gzip/flatgeobuf）を共通実装で追加する
  - shape/location/route のパイプラインに配線する
  - 運用ログ/影響範囲/ロールバック手順を追記する
- 運用ログ：
  - start: 2026-01-03 18:30 JST chunk-store 入力フォーマット拡張の調査に着手。
  - done: 2026-01-03 19:10 JST ExecPlan を作成。
  - done: 2026-01-03 19:32 JST runtime-worker/gis-sdk/shape/location/route への配線と型更新を完了（未検証）。

2033) chore/analysis/geoboundaries-usage-scan (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-usage-scan
- 依存: なし
- 受け入れ基準: geoboundaries.json の直接参照箇所を全件列挙する／shape-plugin 以外での利用有無を明示する
- 要点：geoboundaries.json の直接 import は shape-plugin の MetadataLoader に限定され、他の直接参照は存在しない。
- チェックリスト:
  - 直接参照箇所を列挙する
  - shape-plugin 以外の利用有無を整理する
- 運用ログ：
  - start: 2026-01-03 17:30 JST geoboundaries.json の利用箇所スキャンに着手。
  - done: 2026-01-03 17:31 JST 直接参照は shape-plugin のみであることを確認。

2032) chore/analysis/geoboundaries-iso2-rootcause (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-iso2-rootcause
- 依存: なし
- 受け入れ基準: geoboundaries.json の取得元が自己参照であることを説明する／iso2 の取得・保存経路を特定する／iso2 が空になる理由をデータ源/加工観点で明示する
- 要点：generate-metadata.mjs のフォールバックは repo の raw JSON 自体を再取得する構成で、iso2 は加工されず元データの空文字がそのまま保存されていることを確認した。
- チェックリスト:
  - 取得元URLの決定ロジックを整理する
  - iso2 の加工有無を確認する
  - 空文字の発生理由を説明する
- 運用ログ：
  - start: 2026-01-03 17:26 JST geoboundaries.json の iso2 空文字原因調査に着手。
  - done: 2026-01-03 17:28 JST 取得元URLと未加工保存の経路を特定し、空文字が元データ起因であることを整理。

2032) feat/chunk-store/migrate-download (P1) — 進行中 (2026-01-03)
- ブランチ名: feat/chunk-store/migrate-download
- 依存: なし
- ExecPlan: plans/chunk-store-migration-execplan.md
- 受け入れ基準: @hierarchidb/chunk-store を新設し、Dexie DB/テーブルとシリアライザ/デシリアライザを注入できる設計になっている／relation テーブル（nodeId + metadataId）と同値性判定（url/etag/url+etag/hash）を持ち、chunk set の作成/削除時に nodeId を渡す設計になっている／@hierarchidb/download はネットワーク/認証補助の低レベル API に簡素化され、chunk-store が内部的に FetchNetworkPort を利用する構成になっている／高レベル API に混在していた責務がプラグイン側へ移譲され、serializer/deserializer 注入で用途を実現している／対象プラグインで serializer/deserializer + nodeId 注入の実装に置き換わっている／TASKS.md に運用ログ・影響範囲・ロールバック手順が記載されている
- チェックリスト:
  - ExecPlan を作成し、方針と検証手順を明文化する
  - chunk-store パッケージの設計と API を定義する
  - download から汎用 chunk store 責務を分離し、chunk-store 経由に整理する
  - プラグイン側でシリアライザ/デシリアライザ注入の実装へ移行する
  - 運用ログ start/done/blocked を追記する
- 要点：@hierarchidb/chunk-store に relation テーブル（nodeId + metadataId）と同値性判定（url/etag/url+etag/hash）を追加し、nodeId 必須の set/get/delete API を実装。CAS（HashPort/ContentIndexPort/CachePort）を chunk-store へ移設。@hierarchidb/download は FetchNetworkPort/authFetch/postJson/auth通知へ簡素化し、pluginDownloadRegistry/createDownloadService/DexieChunkStoragePort を撤去。shape/route/runtime-worker/spreadsheet の URL 取得や一時保存を chunk-store ベースへ移行し、conditional caching と dedupe を維持。
- 影響範囲：`packages/features/download`, `packages/features/chunk-store`, `plugins/shape-plugin`, `plugins/route-plugin`, `packages/runtime-worker`, `plugins/spreadsheet-plugin` とそれぞれの package.json/README/テスト。
- ロールバック：chunk-store 追加と download API 変更を revert し、旧 downloadJson/getPluginDownloadService/DexieChunkStoragePort ベースへ戻す。relation テーブル/identity 判定の導入を差し戻し、プラグイン側は旧 download helper 呼び出しに差し替える。
- 運用ログ：
  - start: 2026-01-03 19:35 JST ExecPlan 作成に着手。
  - start: 2026-01-03 20:12 JST chunk-store 移行作業の実装に着手。
  - blocked: 2026-01-03 20:46 JST `pnpm --filter @hierarchidb/chunk-store typecheck` が node_modules 不在で失敗（@hierarchidb/download/@hierarchidb/util の型解決不可）。
  - start: 2026-01-03 21:05 JST chunk-store の relation/cas 移設作業に着手。
  - done: 2026-01-03 21:38 JST relation + CAS 移設と nodeId 必須 API への移行を完了（検証は node_modules 不在で未実施）。
  - start: 2026-01-09 02:55 JST shape Step3/spreadsheet の URL 取得で実ノードIDを渡す対応に着手。
  - done: 2026-01-09 03:12 JST shape Step3 の metadata 取得と spreadsheet URL ダウンロードで nodeId を伝播する修正を反映（検証は未実施）。

2031) chore/analysis/geoboundaries-output-trace (P2) — 完了 (2026-01-03)
- ブランチ名: chore/analysis/geoboundaries-output-trace
- 依存: なし
- 受け入れ基準: packages/features/fetch-save-metadata/output/geoboundaries.json の生成元パッケージ/ファイルを特定する／アクセス先URLを特定する／取得内容と加工フローをコード参照付きで説明する／保存処理のタイミングと出力経路を説明する
- 要点：geoboundaries.json を生成するスクリプト・アクセスURL・加工/保存フローを整理し、関連ファイルを特定した。
- チェックリスト:
  - 生成元パッケージ/ファイル/関数を特定する
  - アクセス先URLとレスポンス形式を特定する
  - 加工フローをコード参照付きで整理する
  - 保存処理の流れを整理する
- 運用ログ：
  - start: 2026-01-03 17:20 JST geoboundaries.json 生成フローの調査に着手。
  - done: 2026-01-03 17:22 JST 生成元スクリプトとURL/加工/保存フローを整理。

2030) refactor/download/api-slim-anyless (P1) — 完了 (2026-01-03)
- ブランチ名: refactor/download/api-slim-anyless
- 依存: なし
- ExecPlan: plans/download-api-shape-step3-execplan.md
- 受け入れ基準: @hierarchidb/download の any を排除し型付けを改善する／download API の入口を現行ユースケースに合わせて整理する／shape-plugin Step3 の country metadata 取得が download サービス層を経由し、キャッシュとコンテントネゴシエーションが有効になる／TASKS.md に運用ログ・影響範囲・ロールバック手順が記載されている
- 受け入れ基準: packages/features/fetch-save-metadata/src/utils/fetchWithRetry.ts を削除し、@hierarchidb/download を使う実装に移行する
- 要点：@hierarchidb/download の any を排除し API 公開範囲を整理、downloadJson に条件付きキャッシュを追加。Step3 の geoBoundaries availability を cache+コンテントネゴシエーションで取得し、fetch-save-metadata の fetchWithRetry を撤去して FetchNetworkPort に統一。
- 原因/影響範囲：Step3 の geoBoundaries availability 取得で CORS/再取得が発生しやすく、download パッケージに冗長な公開 API と any 使用が残っていた。fetch-save-metadata にも重複したリトライ実装があり、責務が分散していた。影響範囲は download パッケージの公開 API、shape-plugin Step3 availability、fetch-save-metadata の取得処理。
- 修正内容と適用範囲：download の型付けと公開 API を整理し、downloadJson に `cache: 'conditional'` を追加、Dexie ストレージに ETag/Last-Modified を保存。Step3 で geoBoundaries availability の取得を条件付きキャッシュに切り替え。fetch-save-metadata は FetchNetworkPort に置換し fetchWithRetry を削除。適用範囲は `packages/features/download/src/ports.ts`, `packages/features/download/src/adapters/DexieChunkStoragePort.ts`, `packages/features/download/src/adapters/FetchNetworkPort.ts`, `packages/features/download/src/createDownloadService.ts`, `packages/features/download/src/pluginDownloadRegistry.ts`, `packages/features/download/src/index.ts`, `packages/features/download/README.md`, `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`, `plugins/shape-plugin/src/services/utils/geoBoundariesAvailability.ts`, `packages/features/fetch-save-metadata/src/fetchSaveMetadata.ts`, `packages/features/fetch-save-metadata/package.json`, `packages/features/fetch-save-metadata/src/utils/fetchWithRetry.ts`（削除）, `plugins/route-plugin/src/common/orchestrator/__tests__/unit/auth-notify.unit.test.ts`, `plans/download-api-shape-step3-execplan.md`。
- 検証：`pnpm --filter @hierarchidb/download typecheck`（成功）／`pnpm --filter @hierarchidb/download build:types`（成功）／`pnpm --filter @hierarchidb/shape-plugin typecheck`（成功）。
- ロールバック手順：上記ファイルの差分を revert し、fetchWithRetry.ts を復元する。
- チェックリスト:
  - ExecPlan を作成し、方針と検証手順を明文化する
  - @hierarchidb/download の any 使用箇所を洗い出して型修正する
  - download API の入口を整理し、移行方針を記述する
  - Step3 の country metadata 取得を download サービス層へ移行し、キャッシュ/コンテントネゴシエーションを導入する
  - fetch-save-metadata の fetchWithRetry を削除し、download 経由に置換する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-03 17:19 JST ExecPlan 作成に着手。
  - done: 2026-01-03 17:42 JST download API 整理と Step3/metadata 取得のキャッシュ対応を完了。
  - done: 2026-01-03 18:37 JST download/shape-plugin の型検証を完了。

2029) fix/shape/step3-geoboundaries-availability-cors (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step3-geoboundaries-availability-cors
- 依存: なし
- 要点：Step3 の availability worker に CORS プロキシ設定を注入し、geoBoundaries の availability 取得が download 経由で動作するようにした。
- 原因/影響範囲：country availability worker が CORS プロキシ設定なしで geoboundaries API にアクセスし、ブラウザで CORS エラーが発生していた。影響範囲は Step3 の geoBoundaries 可用レベル取得とローディング表示。
- 修正内容と適用範囲：`countryAvailability.worker.ts` で `VITE_CORS_PROXY_BASE_URL` を読み込み `setCorsProxyBaseURL` を設定。適用範囲は `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`。
- 検証：未実施（UI での CORS 再現と確認は未実行）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 17:03 JST Step3 geoBoundaries availability の CORS 対応に着手。
  - done: 2026-01-03 17:03 JST availability worker に CORS プロキシ設定を追加。

2028) fix/shape/step5-resume-build-label (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step5-resume-build-label
- 依存: なし
- 要点：Step5 の Resume 表記を「Resume Build」へ戻し、i18n（英語/日本語）も Build 表記に揃えた。
- 原因/影響範囲：commit 3c8168b（2025-12-31）の “build” → “stage” 置換で Resume ラベルが「Resume stage」へ変わっていた。影響範囲は Shape Step5 の開始/再開コントロール表示とロケール定義。
- 修正内容と適用範囲：`ShapeBuildStep` の Resume ラベル既定文字列を「Resume Build」に戻し、`stage.controls` の i18n を追加。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` と `plugins/shape-plugin/src/ui/locales/{en,ja}.json`。
- 検証：未実施（文言差し替えのみ）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 16:59 JST Step5 の Resume ラベル修正と i18n 対応に着手。
  - done: 2026-01-03 17:00 JST Resume ラベルと i18n を Build 表記へ復元。

2027) fix/shape/step5-start-build-label (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step5-start-build-label
- 依存: なし
- 要点：Shape Step5 の開始ボタンラベルを「Start Build」に戻した。
- 原因/影響範囲：commit 3c8168b（2025-12-31）で “build” から “stage” へ用語統一した結果、Step5 の開始ラベルが「Start stage」へ変更されていた。影響範囲は `ShapeBuildStep` の開始ボタン表示。
- 修正内容と適用範囲：`startLabel` のデフォルト文字列を「Start Build」に戻した。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`。
- 検証：未実施（ラベル文言の差し替えのみ）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 00:00 JST Step5 のラベル変更履歴調査と修正に着手。
  - done: 2026-01-03 00:15 JST ラベルを「Start Build」に復元し、経緯を整理。

2026) feat/shape/dynamic-country-matrix (P1) — 完了 (2026-01-09)
- 要点：Shape Step3 の国×自治体レベルマトリクスをメタデータ駆動でオンデマンド生成し、データソース別ストラテジー＋WebWorkerで可用レベルを取得してUIへ反映するようにした。
- 原因/影響範囲：従来は geoBoundaries 固定でレベル2までの静的前提だったため、他データソースや実際の可用レベルに追随できず UI が実態と乖離するリスクがあった。影響範囲は shape-plugin Step3 UI（国×自治体レベル選択）と可用性取得の裏側ロジック。
- 修正内容と適用範囲：ストラテジーID解決を共通化、データソース可用性解決サービスと Comlink WebWorker を追加し、各ストラテジーが提供する可用性情報やメタデータから国別レベルを構築。Step3 フックは可用性通知を受けてマトリクスを再構成し、非対応セルは「-」を表示、仮想化を維持。適用範囲は `plugins/shape-plugin/src/services/datasources/*`, `plugins/shape-plugin/src/ui/hooks/useShapeCountrySelectionStep.ts`, `plugins/shape-plugin/src/ui/workers/*`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`。
- 検証：`pnpm --filter @hierarchidb/shape-plugin test -- --runInBand --testTimeout=20000`（依存パッケージ @hierarchidb/shape-store / @hierarchidb/util / @hierarchidb/ui-batch-progress の解決不可で失敗。テストは走らず。環境依存のため後続で要再実行）。
- ロールバック手順：上記ファイルの差分を revert（特に `CountryAvailabilityResolver` 追加や Step3 フックの worker 連携部分を戻す）。
- 運用ログ：
  - start: 2026-01-09 00:55 JST Step3 可用性動的化と worker 背景取得の設計開始。
  - done: 2026-01-09 01:25 JST 実装完了。テストは依存解決不可で失敗（要再試行）。

2026) fix/styler/step5-radio-label-click (P1) — 完了 (2026-01-07)
- 要点：Styler Step5 のターゲット選択でラベルテキストをクリックしてもラジオが選択されるよう FormControlLabel で関連付け、既存レイアウトを維持。
- 原因/影響範囲：ラジオとラベルを別要素で描画し for 関連付けがなかったため、ラベルクリックが無反応だった。影響範囲は Styler Step5 のターゲット選択 UI。
- 修正内容と適用範囲：ターゲットオプション行を FormControlLabel に置き換え、Radio とラベルテキストを一体化。適用範囲は `StylerTargetStep` のターゲット選択部分。
- 検証：未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。
- ロールバック手順：`plugins/styler-plugin/src/ui/components/StylerTargetStep.tsx` と `TASKS.md` の差分を revert する。
- 運用ログ：
  - start: 2026-01-07 10:15 JST Step5 ラジオボタンのラベルクリック対応に着手。
  - done: 2026-01-07 11:05 JST FormControlLabel でラジオとラベルを結合し、ラベルクリックで選択できるよう修正。検証: 未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。ロールバック: 上記差分を revert。
2118) fix/app/comlink-apply-on-load (P1) — 進行中 (2026-01-11)
- ブランチ名: fix/app/comlink-apply-on-load
- 依存: なし
- 受け入れ基準: `http://localhost:4200/` へのアクセスだけで `comlink.mjs:51 ... apply` エラーが再現しない／原因・発生範囲・修正方法と適用範囲を説明する／TASKS.md に運用ログを記載する
- 影響範囲: `app/src/**`, `packages/plugin-service-sdk/src/**`, `packages/runtime-worker/src/**`（調査後に絞り込み）
- ロールバック手順: 該当差分を revert し、アクセス時の Comlink 初期化挙動を元に戻す
- チェックリスト:
  - エラー発生箇所と再現条件を特定する
  - Comlink 呼び出しで undefined になる経路を修正する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-11 17:10 JST localhost:4200 アクセス時の Comlink apply エラー調査に着手。
  - update: 2026-01-11 17:32 JST useTreeNodeInfoPanel の ui-plugin-loader import パスを修正し、Vite の import 解決エラーを解消。検証: 未実施。
2179) refactor/ui/build-step-stage-panel (P2) — 完了 (2026-01-10)
- ブランチ名: refactor/ui/build-step-stage-panel
- 依存: なし
- 受け入れ基準: BuildStep のステージ描画が BuildStepStagePanel に分離され、BuildStepStagePanel 内で要約表示が BuildStepStageHeaderPanel、詳細表示が BuildStepStageDetailsPanel に分離されている／表示内容と挙動が現状と同等である／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageDetailsPanel.tsx`
- ロールバック手順: 追加ファイルと差分を revert し、BuildStep 内のインライン描画へ戻す
- チェックリスト:
  - BuildStepStagePanel を追加し、BuildStep から分離する
  - BuildStepStageHeaderPanel/BuildStepStageDetailsPanel を追加し、役割を分ける
  - 表示/進捗/展開の挙動を維持する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 18:40 JST BuildStep のステージ描画分離に着手。
  - done: 2026-01-10 18:54 JST BuildStepStagePanel/BuildStepStageHeaderPanel/BuildStepStageDetailsPanel を追加し、BuildStep から分離。検証: 未実施。
2180) feat/ui/build-step-stage-mode-toggle (P2) — 完了 (2026-01-10)
- ブランチ名: feat/ui/build-step-stage-mode-toggle
- 依存: なし
- 受け入れ基準: BuildStepStagePanel が taskCount を管理しステージ単位で渡す／BuildStepStageHeaderPanel と BuildStepStageDetailsPanel が memo 化される／Failed/Completed Chip がアイコン付きでクリック時に mode 更新できる／failedMode/completedMode の真偽でタスク表示を制御できる／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStep.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageDetailsPanel.tsx`
- ロールバック手順: 追加差分を revert し、従来のステージ表示と固定表示へ戻す
- チェックリスト:
  - taskCount 集計を BuildStepStagePanel に集約する
  - Failed/Completed モードのトグルを追加する
  - summary/details を memo 化する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-10 19:28 JST BuildStepStagePanel のモード切替と taskCount 集計に着手。
  - done: 2026-01-10 19:38 JST summary/details の memo 化、Chip トグルとモード制御、taskCount 集計とフィルタを追加。検証: 未実施。

2212) feat/ui/dialog-display-mode-persist (P1) — 進行中 (2026-01-15)
- ブランチ名: feat/ui/dialog-display-mode-persist
- 依存: なし
- 受け入れ基準: プラグイン編集ダイアログの表示モード切り替え時に対象ノードの dialogUIState.dialogWindow.mode が即時更新される／永続化され再オープン時に復元される／create/preview では永続化しない／既存の保存・クローズ動作に副作用がない／TASKS.md に運用ログを記載する
- 影響範囲: `packages/plugin-ui-host/src/headless/usePluginDialogController.tsx` ほか（調査後に確定）
- ロールバック手順: 該当差分を revert し、表示モード永続化を切り戻す
- チェックリスト:
  - 表示モード切り替え時に dialogUIState を更新する
  - 永続化のタイミングを追加する
  - create/preview で永続化しないことを確認する
  - 既存の保存/クローズ動作に影響がないことを確認する
  - 必要ならテストを追加する
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-15 23:11 JST 表示モード切り替え時の永続化対応に着手。
  - update: 2026-01-15 23:14 JST 表示モード切り替え時に dialogUIState を保存する処理を追加。
2229) feat/ui-map/interaction-core (P1) — 進行中 (2026-01-19)
- ブランチ名: feat/ui-map/interaction-core
- 依存: なし
- 受け入れ基準: ui-map に Shape/Route 一覧画面の共通コードが追加され、shape-plugin/route-plugin は最小限の設定で利用できる／一覧画面に「エラー関連カラム群（Completed/Failed 等）」が統合される／FitScreen/検索/ホバー/選択/検索一致/ハイライト/Snackbar/矩形選択/検索Enter-fit が ui-map 共通機能として実装され、プロパティで有効/無効を切替可能／shape-plugin Step6 ではタブ内のエラー一覧は復活せず、ui-map 共通コードへ移管する／pnpm typecheck が exit 0 で完走する
- 影響範囲: `packages/ui/map/src/**`, `plugins/shape-plugin/src/ui/components/step6/**`, `plugins/route-plugin/src/ui/**`（調査後に確定）
- ロールバック手順: ui-map 共通一覧/interaction の追加差分と plugin 側の切り替え差分を revert し、従来の個別実装へ戻す
- チェックリスト:
  - ExecPlan を作成し、設計/移行/検証手順を明文化する
  - ui-map に Shape/Route 一覧画面の共通コンポーネントを追加する
  - エラー関連カラム群を共通化し、一覧表示へ統合する
  - FitScreen/検索/ホバー/選択/検索一致/ハイライト/Snackbar/矩形選択/検索Enter-fit を ui-map 側で実装し、プロパティで切替可能にする
  - shape-plugin/route-plugin を ui-map 共通コードの利用へ切り替える（最小限の実装）
  - pnpm typecheck を実行しログに記録する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-19 00:00 JST ui-map の共通一覧/interaction 実装と plugin 側切替に着手。
  - update: 2026-01-19 00:35 JST ui-map に Shape/Route の一覧コンポーネントを追加し、shape/route preview の一覧表示を共通化へ切替。
  - blocked: 2026-01-19 00:40 JST pnpm typecheck が vt-orchestrator の既存型エラーで失敗（preSimplifyFilterConfig, geometry.ts 型不整合）。
  - blocked: 2026-01-19 00:55 JST git fetch origin ERIA-Cartograph が sandbox 制限で失敗（.git/FETCH_HEAD へアクセス不可）。
  - update: 2026-01-19 01:05 JST 権限付与後に git fetch origin ERIA-Cartograph が成功。
  - update: 2026-01-19 01:10 JST pnpm typecheck を実行（exit 0、tsdown define 警告あり）。
  - update: 2026-01-19 01:25 JST pnpm install を実行（peer dependency 警告あり）。
  - update: 2026-01-19 01:26 JST pnpm typecheck を再実行（exit 0、tsdown define 警告あり）。
2291) fix/shape/step5-skipped-toggle (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/step5-skipped-toggle
- 依存: なし
- 受け入れ基準: Step5ヘッダーにSkippedのChipトグルが追加される／Skippedの抽出表示がCompleted/Failedと同様に切替できる／TaskProgressBar の a11y lint が解消される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/components/src/BuildStepStagePanel.tsx`, `packages/components/src/BuildStepStageFilterContext.tsx`, `packages/components/src/BuildStepPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`, `plugins/shape-plugin/src/ui/components/step5/TaskProgressBar.tsx`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - Skippedフィルタ状態を追加し、Stageヘッダーで切替できるようにする
  - タスク一覧でSkipped抽出が有効になることを確認する
  - TaskProgressBarのa11y lintを解消する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 23:40 JST Step5のSkippedトグルとTaskProgressBarのa11y修正に着手。
  - update: 2026-01-22 23:50 JST components の dist 型が未更新で typecheck 失敗したため、pnpm --filter @hierarchidb/components build を実行。
  - done: 2026-01-22 23:55 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。

2292) fix/shape/vt-summary-message-format (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/vt-summary-message-format
- 依存: なし
- 受け入れ基準: vt完了時のメッセージが `tiles {processed}/{total} | input(...) output(...)` 形式になる／進捗メッセージの形式は維持される／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/vt/vtStage.ts`
- ロールバック手順: メッセージ生成差分を revert する
- チェックリスト:
  - vt完了時メッセージのフォーマットを変更する
  - input/output 集計を完了時に出力できるようにする
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 00:10 JST vt完了時メッセージを進捗形式に合わせる対応に着手。
  - done: 2026-01-23 00:20 JST pnpm typecheck exit 0 を確認（tsdown define 警告あり）。

2293) fix/shape/vt-task-status-sync (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/vt-task-status-sync
- 依存: なし
- 受け入れ基準: Step5のタスク一覧とサマリーがビルド完了時に必ず完了状態へ遷移する／Running/Queuedの孤児が残らない／vt完了時のmessageが一覧とサマリーで一致する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressPanel.tsx`, `plugins/shape-plugin/src/ui/components/step5/ShapeBuildProgressStageContent.tsx`, `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/step5/useBuildProgress.ts`（必要に応じて追加）
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - vt完了時にtaskSummary/一覧が完了状態へ更新されることを確認する
  - Running/Queuedの孤児が残らないことを確認する
  - message出力の整合性をタスク一覧とサマリーで統一する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-23 01:10 JST vtステージ完了時のtaskSummary/一覧同期不整合の修正に着手。
  - update: 2026-01-23 01:20 JST 完了後のRunning/Queued孤児検知時にタスク再取得を行う同期処理を追加。
  - update: 2026-01-23 01:22 JST shapePipeline のタイル交差判定に型ガードを追加し typecheck を復旧。
  - done: 2026-01-23 01:23 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。
  - update: 2026-01-23 01:30 JST 完了イベントで必ず最終タスク一覧を確定する根本修正の検討に着手。
 - update: 2026-01-23 01:40 JST 完了イベントで最終タスク一覧を取得し、未完タスクがある間は自動更新を継続するよう修正。
 - done: 2026-01-23 01:41 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

2294) fix/shape/step6-map-no-render (P1) — 進行中 (2026-01-23)
- ブランチ名: fix/shape/step6-map-no-render
- 依存: なし
- 受け入れ基準: Step6でタイル/レイヤーが描画される（ADM0/ADM1が表示される）／原因・発生範囲・修正方法と適用範囲を説明する／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/step6/**`, `packages/ui/map/src/**`, `plugins/shape-plugin/src/services/**`（調査後に確定）
- ロールバック手順: 該当差分を revert し、Step6の表示挙動を元に戻す
- チェックリスト:
  - Step6のタイル取得/描画経路を確認し、欠落点を特定する
  - 修正後にADM0/ADM1が描画されることを確認する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
- start: 2026-01-23 04:20 JST Step6でタイルが表示されない件の原因調査に着手。
- update: 2026-01-23 04:40 JST Step6のプレビューで admin0/admin1 レイヤーを明示指定し、layer0 既定を廃止する修正に着手。
- update: 2026-01-23 05:05 JST Step6で地物が表示されないため、MVTレイヤ名とStep6の参照レイヤの整合性を再調査中。
- update: 2026-01-23 06:10 JST Step6のタイル供給/描画/インタラクション経路の再検証と修正に着手。
- update: 2026-01-23 06:25 JST Step6のhover/snackbar無効設定とタイル取得経路の不整合を修正する方針で調査・修正に着手。
  - done: 2026-01-23 04:42 JST pnpm --filter @hierarchidb/shape-plugin typecheck exit 0 を確認。

  - update: 2026-01-21 17:51 JST Step6の地物未表示/ホバー無反応の原因調査と修正方針を開始。
2291) fix/shape/tile-bbox-coordinate-system (P1) — 進行中 (2026-01-22)
- ブランチ名: fix/shape/tile-bbox-coordinate-system
- 依存: なし
- 受け入れ基準: タイルbboxとGeoJSON座標系の整合が取れるように修正する／transformのタイルインデックスが実ジオメトリ交差に基づくことを確認できる／vtの「featuresあり・tiles 0」が再発しない／pnpm typecheck が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, `plugins/shape-plugin/src/services/vt/shapePipeline.ts`（必要に応じて追加）
- ロールバック手順: タイルbbox整合・交差判定の差分を revert する
- チェックリスト:
  - タイルbboxの座標系を確認し、GeoJSON座標系と合わせる
  - transformのtile index作成で実ジオメトリ交差に基づく判定を追加する
  - pnpm typecheck を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 20:10 JST タイルbboxの座標系不整合と交差判定の確認・修正に着手。
  - update: 2026-01-22 20:25 JST タイルbboxはlon/lat前提であることを確認し、transformのtile index作成をbboxクリップによる実ジオメトリ交差判定に変更。
  - update: 2026-01-22 20:30 JST shapePipeline側のタイルID収集も同様にクリップ判定へ変更。
  - done: 2026-01-22 20:33 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-22 20:45 JST per-tile indexでclip済みfeatureがあるのにgeojson-vtが空タイルを返す場合は警告ログを出し、vtタスクをfailedにするよう修正。
  - done: 2026-01-22 20:48 JST pnpm --filter @hierarchidb/vt-orchestrator typecheck exit 0 を確認。
  - update: 2026-01-23 03:20 JST tiles 0/1 など空タイル発生の原因特定（転置インデックス/タイル交差/geojson-vt入出力）を再調査開始。
2293) test/shape/step6-tile-verification (P1) — 完了 (2026-01-22)
- ブランチ名: test/shape/step6-tile-verification
- 依存: なし
- 受け入れ基準: Step5で生成されたタイルがShapeDBに保存されることをテストで確認する／Step6のプレビューがShapeDBを参照してタイル取得を試みることをテストで確認する／vtタスクのレイヤー集計表示がタイルのレイヤー構成に基づくことをテストで確認する／pnpm --filter @hierarchidb/shape-plugin test が exit 0／pnpm --filter @hierarchidb/vt-orchestrator test が exit 0／TASKS.md に運用ログを記載する
- 影響範囲: `plugins/shape-plugin/src/headless/__tests__/**`, `plugins/shape-plugin/src/ui/__tests__/**`, `packages/vt-orchestrator/src/vt/__tests__/**`（テスト参照のみ）
- ロールバック手順: 追加したテストファイルとテスト用のモック差分を revert する
- チェックリスト:
  - Step5のタイル保存を検証するテストを追加する
  - Step6のタイル参照経路を検証するテストを追加する
  - vtタスクのレイヤー集計表示を検証するテストを追加する
  - pnpm --filter @hierarchidb/shape-plugin test を実行する
  - pnpm --filter @hierarchidb/vt-orchestrator test を実行する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-22 21:30 JST Step5/Step6のタイル検証テスト整備に着手。
  - update: 2026-01-23 19:00 JST vtStageのサマリ関数テストとStep6タイル参照テスト、Step5タイル保存テストを追加。
  - update: 2026-01-23 19:00 JST pnpm --filter @hierarchidb/vt-orchestrator test exit 0 を確認。
  - blocked: 2026-01-23 19:02 JST pnpm --filter @hierarchidb/shape-plugin test が geoboundaries.org の DNS 解決失敗（ENOTFOUND）で失敗。ネットワーク到達確認/対応方針の指示待ち。
  - done: 2026-01-23 19:05 JST pnpm --filter @hierarchidb/shape-plugin test exit 0 を確認。
