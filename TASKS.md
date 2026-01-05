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
- 受け入れ基準: TileConfigSection の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx`
- ロールバック手順: `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - TileConfigSection のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:35 JST TileConfigSection の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:36 JST zoomBreakpoints の比較を値ベースに修正し、同期ループを抑止。

2084) fix/ui/download-retry-controls-render-loop (P1) — 完了 (2026-01-05)
- ブランチ名: fix/ui/download-retry-controls-render-loop
- 依存: なし
- 受け入れ基準: DownloadRetryControls の Maximum update depth exceeded が解消される／再レンダーが安定し無限ループしない／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `plugins/shape-plugin/src/ui/hooks/useDownloadConfigSection.ts`
- ロールバック手順: `plugins/shape-plugin/src/ui/hooks/useDownloadConfigSection.ts` の差分を revert し、警告が出ていた状態へ戻す
- チェックリスト:
  - DownloadRetryControls のレンダーループ原因を特定する
  - 依存配列/状態更新の安定化を実装する
  - 影響範囲とロールバック手順を更新する
  - 運用ログ start/done/blocked を追記する
- 運用ログ：
  - start: 2026-01-05 14:33 JST DownloadRetryControls の Maximum update depth エラー対応に着手。
  - done: 2026-01-05 14:34 JST useDownloadConfigSection の loadCounts effect 依存を整理し、無限レンダーを抑止。

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
- 影響範囲: `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts`（必要に応じて）
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
- 受け入れ基準: ShapeBatchApiClient.ts の型不整合を解消する／Extract1SourceBuffer/Extract2SourceBuffer の命名へ統一する／関連型とAPIの参照が揃っている／TASKS.md に運用ログ・影響範囲・ロールバック手順を記載する
- 影響範囲: `packages/plugin-service-api/src/types/*`, `packages/features/shape-store/src/EphemeralShapeDB.ts`, `packages/features/shape-store/src/index.ts`, `plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts`, `plugins/shape-plugin/src/services/batch/*`, `packages/runtime-worker/src/services/*`（必要に応じて）
- ロールバック手順: 上記ファイルの命名/型変更を revert し、従来の ShapeExtractedBufferRecord / ExtractedFeatureBuffer 名称へ戻す
- チェックリスト:
  - ShapeBatchApiClient.ts の型不整合箇所を修正する
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
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `packages/plugin-service-api/src/types/shapeBatchTypes.ts`, `packages/features/shape-store/src/ShapeDB.ts`（必要に応じて）
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
- 影響範囲: `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `plugins/shape-plugin/src/services/batch/SessionArtifactStore.ts`, `plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts`（必要に応じて）
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
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/ui/hooks/useDownloadConfigSection.ts`
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
- 影響範囲: `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts`, `plugins/shape-plugin/src/common/types/batch.ts`, `plugins/shape-plugin/src/services/batch/session/extract2/zoomRanges.ts`, `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/assembleTileGeoJSON.ts`, `plugins/shape-plugin/src/services/batch/ShapeBatchApiClient.ts`, `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, `plugins/shape-plugin/src/services/VectorTileDB2Procedure.ts`, `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx`, `plugins/shape-plugin/src/worker/api.ts`, `plugins/shape-plugin/package.json`
- ロールバック手順: 上記ファイルの差分を revert する
- チェックリスト:
  - BatchTaskBase の stage/type を埋める
  - zoomRanges と TileConfigSection の undefined を解消する
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
- 影響範囲：`packages/runtime-worker/src/services/vectorTileStageRunner.ts`, `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages/runtime-worker/src/types.ts`, `packages/features/gis-sdk/src/vectorTiles.ts`, `packages/features/gis-sdk/src/index.ts`, `packages/plugin-service-api/src/types/shapeBatchTypes.ts`, `plugins/shape-plugin/src/common/types/BatchConfig.ts`, `plugins/shape-plugin/src/services/batch/session/tiles/vectorTileTasks.ts`, `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, `packages/features/location-store/src/index.ts`, `plugins/location-plugin/src/services/batch/LocationSessionController.ts`, `plugins/location-plugin/package.json`, `packages/features/route-store/src/index.ts`, `plugins/route-plugin/src/services/RouteBatchSession.ts`, `plugins/route-plugin/src/services/RouteVectorTileService.ts`, `plugins/route-plugin/package.json`, `vitest.setup.base.ts`。
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
- 修正内容と適用範囲：`ShapeBuildProgressStep` の Resume ラベル既定文字列を「Resume Build」に戻し、`stage.controls` の i18n を追加。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx` と `plugins/shape-plugin/src/ui/locales/{en,ja}.json`。
- 検証：未実施（文言差し替えのみ）。
- ロールバック手順：上記ファイルと本項目の差分を revert。
- 運用ログ：
  - start: 2026-01-03 16:59 JST Step5 の Resume ラベル修正と i18n 対応に着手。
  - done: 2026-01-03 17:00 JST Resume ラベルと i18n を Build 表記へ復元。

2027) fix/shape/step5-start-build-label (P1) — 完了 (2026-01-03)
- ブランチ名: fix/shape/step5-start-build-label
- 依存: なし
- 要点：Shape Step5 の開始ボタンラベルを「Start Build」に戻した。
- 原因/影響範囲：commit 3c8168b（2025-12-31）で “build” から “stage” へ用語統一した結果、Step5 の開始ラベルが「Start stage」へ変更されていた。影響範囲は `ShapeBuildProgressStep` の開始ボタン表示。
- 修正内容と適用範囲：`startLabel` のデフォルト文字列を「Start Build」に戻した。適用範囲は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildProgressStep.tsx`。
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
