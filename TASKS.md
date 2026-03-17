# TASKS.md

## Doing

- #1123 / `fix/app/subscribe-task-progress-1123` / 2026-03-17 開始
- #1127 / `fix/shape-plugin/task-progress-version-gate-and-idle-fallback` / 2026-03-17 開始
- #1020 / `refactor/shape-plugin/build-session-event-redesign-1020` / 2026-03-14 開始
- #1019 / `fix/shape-plugin/task-snapshot-race-on-build-start-1019` / 2026-03-14 開始
- #1018 / `fix/shape-plugin/runtime-refresh-after-start-1018` / 2026-03-14 開始
- #983 / `fix/shape-plugin/rename-steps-processing-to-config` / 2026-03-10 開始
- #970 / `fix/i18n/stepper-basic-info-label-key` / 2026-03-10 開始
- #969 / `refactor/review/gemini-review-batch-fixes` / 2026-03-10 開始


## Blocked

- 2026-03-09: mapでshape-styler同一フォルダ紐付け実装着手 blocked（`gh issue create` 実行時 `gh: command not found`、`apt-get install gh` はプロキシ 403 で失敗）。解除条件: `gh` CLI を利用可能にする（プリインストールまたは実行可能パス提供）。

## 今日の運用ログ

- 2026-03-18: #1147 レビュー対応コミット push（PR #1148 追加コミット）
  - useBuildProgress: `_normalizedPercentage` スプレッドを `lastNormalizedPercentageRef` に置換（型違反解消）
  - useBuildSessionStateTreeBridge: percentage 計算を `computePercentage`（completed+failed+skipped）に統一
  - build-api: `resolveProgressPayloadCounts` / `resolveProgressPercentage` 共有ユーティリティ新設
  - RouteBuildLiveProgress / RouteBuildProgressBar / RouteBuildSummary: ローカル重複ロジック削除、build-api から import に統一
  - typecheck: build-api / build / ui-build-sessions / route-plugin 全 exit 0
  - test: build / ui-build-sessions 全通過

- 2026-03-18: #1147 BuildUnifiedProgressInfo → BuildProgressEvent alias 化・payload 必須化・throw 化・PR #1148 作成
  - BuildProgressPayload.total/completed/failed を必須フィールドに昇格
  - BuildUnifiedProgressInfo を BuildProgressEvent の type alias に変更（旧 interface 削除）
  - progressEventToUnified: デフォルト補完・clamp 全削除、payload 不在・非 finite は throw
  - useBuildProgress / buildSessionStatusMapper / useBuildSessionStateTreeBridge: payload 経由に変更
  - location-plugin / route-plugin / shape-plugin: payload 経由に変更、不在は throw
  - typecheck: shape-plugin 以外の全パッケージ exit 0（shape-plugin の既存エラーは変更前から存在）
  - test: build / ui-build-sessions / location-plugin 全通過

- 2026-03-17: #1146 location/route plugin を共通ビルド基盤に追いつかせる・main push 完了
  - LocationBuildSession.ts 新設（AbstractBuildSession 継承、全検索ロジック移植）
  - LocationBuildManager.ts 全面置き換え（BaseBuildSessionManager ベース）
  - location-plugin/package.json: build-api / build-runtime-services を dependencies に追加（TS2307 修正）
  - build-runtime-services: toBuildProgressEventFromUpdate / ProgressBridgeUpdate / assertProgressInRange 削除
  - route-plugin RouteBuildManager: ProgressEmitter/ProgressStore/emitProgressEvent 等削除
  - route-plugin RouteBuildSessionOrchestrator: emitter 設計削除、registerSession のみに統一
  - typecheck: exit 0 (119/119)、test: 7 files / 14 tests passed


- 2026-03-17: #1139 taskViewportRangeAtom をステージ別 Record 型に変更・PR #1140 作成
  - shapeBuildProgressAtoms.ts: taskViewportRangeAtom → taskViewportRangeByStageAtom (Record<string, TaskViewportRange>)
  - useTaskItemCardList.ts: stageId キーで書き込み、空タスク時はキー削除
  - useBuildSessionStageCardState.ts: viewportRangeByStage[stage.id] から取得、stageId クロスチェック削除
  - useBuildSessionStageProgressBarState.ts: viewportRangeByStage[activeStageId] から取得
  - typecheck: exit 0 (133/133)

- 2026-03-17: #1137 subscribeSessionState/subscribeStageSnapshots 登録時に現在状態を即時配信・PR #1138作成
  - shapeBuildAPI.ts: subscribeSessionState に getBuildSessionRecord → emitSessionStatusUpdated 即時配信を追加
  - shapeBuildAPI.ts: subscribeStageSnapshots に stageId/stageStartedAt 検証 → emitStageSnapshotUpdated 即時配信を追加
  - typecheck: exit 0 (133/133)、test: 440/440 passed

- 2026-03-17: #1128 taskProgressUpdated に taskId/version 追加・per-task version deduplication 実装・PR #1129作成
  - session-events.ts: TaskProgressUpdatedEvent に taskId: string / version: number 追加
  - eventEmission.ts: emitTaskProgressUpdated に taskId/version パラメータ追加、finite positive integer 検証
  - eventBufferingUI.ts: task-progress の enqueue() 禁止、applyTaskProgress(taskId, version, payload) で per-taskId version deduplication 実装
  - useShapeBuildSessionStateAtomBridge.ts: requireEventShape に safeStringify（循環参照対応）・T['type'] 型改善を適用
  - docs/build-session-worker-ui-event-spec.md: per-taskId deduplication ルール追記
  - typecheck: exit 0

- 2026-03-17: #1126 PR に safeStringify 追加コミット push（コードレビュー対応）
  - workerBootstrap.ts: requireEventType / subscribeWorkerLog の JSON.stringify → safeStringify（循環参照対応）
  - useShapeBuildSessionStateAtomBridge.ts: requireEventShape の expectedType: string → T['type'] に型改善
  - typecheck: exit 0

- 2026-03-17: #1125 Worker→UI イベント型ガード追加・setTimeout撤去・PR #1126作成
  - workerBootstrap.ts: subscribeStageSnapshots/subscribeSessionState/subscribeSessionHeartbeat/subscribeWorkerLog に type フィールド検証追加、不一致は即 throw、API 未実装も throw
  - useShapeBuildSessionStateAtomBridge.ts: run() 内 as キャスト4箇所を requireEventShape に置換、processProgressEvent の stageId undefined フォールバックを throw に変更、scheduleFlush を window.requestAnimationFrame のみに統一
  - typecheck: exit 0 (185/185)、test: 486/486 passed

- 2026-03-17: #1123 subscribeProgress → subscribeTaskProgress 修正・PR #1124作成
  - workerBootstrap.ts: ShapeBuildAPI 型から非存在の subscribeProgress/subscribeTasks を削除、subscribeTaskProgress を追加
  - subscribeBuildProgress: buildApi.subscribeProgress → buildApi.subscribeTaskProgress に修正
  - subscribeBuildTasks: no-op stub に変更（API 契約から削除済み）
  - typecheck: exit 0


- 2026-03-17: #1121 TaskSummary に metadata 追加・PR #1122作成
  - session-events.ts: TaskSummary に metadata フィールド追加
  - useShapeBuildSessionStateAtomBridge.ts: toAdapterStageSnapshotEvent で task.metadata を BuildTaskSummary に渡す
  - typecheck: exit 0 (shape-plugin)

- 2026-03-16: #1119 subscribeToXxx → subscribeXxx リネーム・PR #1120作成
  - shapeBuildAPI 7メソッド、workerBootstrap 型+実装、progressAdapters/external-mocks パラメータ名、テスト3ファイル更新
  - typecheck: exit 0、test: 440/440 passed

- 2026-03-16: #1114 vitest run統一・設定追加・テスト修正・PR #1115作成
  - 14パッケージの test スクリプトを vitest → vitest run に統一
  - 7パッケージに vitest.config.ts 新規追加（build-session-ports/core-types/gis-sdk/plugin-base/ui-routing/ui-worker-provider/vectortile-orchestrator）
  - gis-sdk: preservation.test.ts 修正（version:0追加・put()化・noNaN・事前クリア・stage検証変更）
  - gis-sdk: bugfix.test.ts 修正（db.close()削除・fc.assert await化）
  - vectortile-orchestrator: include パターンを *.test.ts に限定（fakes.ts 誤検知解消）
  - shape-plugin: property テスト3ファイルの API 呼び出し修正
  - gis-sdk: 37/37 passed ✅、vectortile-orchestrator: 7/7 passed ✅

- 2026-03-16: #1111 gh-pages混入ビルド成果物除去・PR #1112作成 / ルート一時ファイル11件除去・PR #1113作成
  - assets/, auth/, templates/, locales/ 等 246 ファイルを git rm --cached
  - AGENTS.md-, e2e-results.*, plugin-test-*.json, test-failure-analysis.md, worker-showconfig.json, tmp*.mjs, tmp_check_menu.*, remove_onWheel.patch を git rm
  - .gitignore に再発防止エントリ追加（両 PR）

- 2026-03-16: #1101 jszip→fflate移行・node:test切り替え・PR #1110作成
  - ImportExportService.ts: jszip → fflate (zipSync/strToU8)
  - テスト: vitest → node:test + node:assert/strict、.mjs 純粋ESMに変換
  - dist/index.js から import して tsx OOM を回避
  - test: 6/6 pass, typecheck: exit 0

- 2026-03-15: #1099 ui-treeconsole-base moveNode失敗テストモック修正・PR #1100作成
  - { success: false } → { result: false } に修正（CRUDResult型と一致）
  - test: 73/73 passed, exit 0

- 2026-03-15: #1097 ui-worker-client sessionChannels テストモック修正・PR #1098作成
  - workerBridge.sessionChannels.unit.test.ts: 旧 getShapeQueryAPI 経由モック → WorkerApi 直接呼び出し（subscribeSessionState/subscribeSessionHeartbeat/subscribeWorkerLog）に修正
  - test: 46/46 passed, exit 0

- 2026-03-15: #1095 download/chunk-store vitest ~/alias 追加・PR #1096作成
  - download/vitest.config.ts: ~/... → src/ alias 追加
  - chunk-store/vitest.config.ts: ~/... → download/src/ alias 追加
  - download: 6/6 passed, chunk-store: 5/5 passed, exit 0
  - ShapeDB を VectorTileRecord から誤 import → ShapeDB.ts から正しく import に修正
  - test: 4/4 passed, exit 0

- 2026-03-15: #1091 location-plugin vitest alias 修正・テスト期待値修正・PR #1092作成
  - vitest.config.ts から存在しない ui-i18n.ts shim alias を削除（dist 経由で正常 resolve）
  - LocationSelectionStep.view test: 翻訳済み文字列 → i18n キー期待値に修正
  - test: 7 files / 14 tests passed, exit 0

- 2026-03-15: #1089 ./common エントリ新設・src/index.ts 削除・PR #1090作成
  - location/route/shape-plugin に src/common/index.ts 追加、src/index.ts 削除
  - package.json exports/typesVersions/build を ./common エントリに更新
  - app/vite.config.ts alias・app/tsconfig.json paths を /common サブエントリに対応
  - build: exit 0、typecheck (plugins + app): exit 0

- 2026-03-15: #1081 4-event spec再適用・テスト新API対応・PR #1088作成
- 2026-03-15: #1082 PR #1085 mainマージ済み / #1083 PR #1084 mainマージ済み
- 2026-03-15: #1072 computeCompletedStageDuration 純粋関数化・as never キャスト除去・PR #1073作成

- 2026-03-15: #1066 computeStageDuration 呼び出し箇所修正・PR #1067作成
  - stageDurationMsByStageAtom の3箇所を computeCompletedStageDuration に修正（#1058 リネーム漏れ）

- 2026-03-15: #1064 subscribers ネストMap最適化・PR #1065作成
  - EventSubscriber インターフェース削除、Map<NodeId, Map<eventType, Set<callback>>> に変更
  - notifySubscribers: 全件スキャン → O(1) ネストマップルックアップ
  - typecheck: 100/100 exit 0、test: 418 passed exit 0

- 2026-03-14: #1042 seqNum gap-check を FIFO+version-gate に置換・PR #1043作成
  - eventBufferingUI.ts: UIEventBufferManager を FIFO キュー（session-state/stage-snapshot）+ version gate（task-progress）に完全書き換え
  - useShapeBuildSessionStateAtomBridge.ts: seqNum 分岐削除、scheduleFlush に統一
  - property テスト 2ファイル（eventDeliveryMonitoringAccuracy / eventDeliveryExtendedScenarios）を新 API に対応
  - test: 423 passed exit 0

- 2026-03-14: #1040 純粋関数エクスポート復元・criticalError テスト nodeId 追加・PR #1041作成
  - isTaskUpdateVersionAfterSnapshot/resolveTaskVersionAction/resolveTaskIdentityAction/resolveSnapshotTargetStages を useShapeBuildSessionStateAtomBridge に export 復元（#1016で消失）
  - buildSessionStateAtoms.unit.test.ts の criticalError payload 2件に nodeId: 'node-1' 追加
  - typecheck: 100/100 exit 0、test: 418/418 pass

- 2026-03-14: #1038 workerBridge.subscribeAll修正・useShapeBuildSessionStateAtomBridge復元・PR #1039作成
  - subscribeAll を Promise.all 5チャンネル同時購読に修正、不正 subscribeTaskProgress 削除
  - useShapeBuildSessionStateAtomBridge を 691f632da (#1016) の正しい状態に git 復元
  - typecheck: ui-worker-client 72/72、shape-plugin 100/100 exit 0

- 2026-03-14: #1031 ビルド関係用語統一リファクタリング・PR #1034作成
  - buildSessionRuntimeAtom → buildSessionLifecycleAtom
  - BuildProgressStatus → BuildSessionDisplayStatus、'processing' → 'running'
  - useShapeBuildStep* → useShapeBuildSession*（hooks/helpers/dirs）
  - shouldClearPersistedTasksOnReset から死んだ lastAcceptedEventVersion を除去
  - criticalError ハンドラーに completedAt: timestamp を追加（バグ修正）
  - 全テストを新イベント型（sessionStatusUpdated/stageSnapshotUpdated/taskProgressUpdated）に更新
  - typecheck: 100/100 exit 0、test: 427/427 pass

- 2026-03-14: #1021 TreeTableCore viewHeight ハードコード削除・PR #1022作成
  - TreeTableCoreProps.viewHeight をオプショナル化
  - TreeConsolePanel viewHeight={600} 削除（2箇所）、親Box に height:'100%' 追加
  - TreeConsoleContent viewHeight||400 フォールバック削除
  - typecheck: 42/42 exit 0

- 2026-03-14: #1020 テスト修正（4イベント新設計対応）・コミット 707f259 / typecheck: 100/100 exit 0 / test: 366/369 pass
- 2026-03-14: #1019 ビルド開始時タスクスナップショット競合修正・コミット bf1c2d1
  - emitTaskSnapshot に taskCallbacks を渡し、putTasks 完了後の完全スナップショットを subscribeBuildTasks コールバックに直接配信
  - 修正箇所: emitStageTaskSnapshotBarrier（ステージ開始時）、空ビルド失敗パス、パイプライン失敗パス（3箇所）
  - typecheck: 100/100 exit 0
  - executeStartFlow に onRuntimeRecord コールバックを追加（BridgeApi に getBuildSessionRuntime を追加）
  - useShapeBuildStart で useSetAtom + createBuildSessionWorkerEventAdapter を使って構築し渡す
  - prop drilling なし（変更ファイル: executeStartFlow.ts / types.ts / useShapeBuildStart.ts）
  - typecheck: 100/100 exit 0

- 2026-03-13: #1016 subscribeAll統合・PR #1017作成
  - BuildWorkerBridgeにsubscribeAll追加、subscribeSessionHeartbeat/subscribeTaskProgress削除
  - useShapeBuildSessionStateAtomBridgeを608行→約230行に簡素化（subscribeAll 1回呼び出し）
  - eventBufferingUI.ts non-null assertion修正
  - typecheck: 100/100 exit 0、test: 366/369 pass


- 2026-03-12: #1006 useAtomValue+useRef同期をuseStore().get()に置換・PR #1008作成
  - buildSessionSnapshotHandshakeReceivedAtom の二重管理（useAtomValue+useRef）を削除
  - useStore() でSSOT状態木から直接読む形に変更
  - typecheck: 100/100 exit 0、test: 372/372 pass

- 2026-03-12: #1000 useLayoutEffect依存配列ループ修正・PR #1001作成
  - buildSessionSnapshotHandshakeReceived を useRef 化、依存配列から除去
  - typecheck: 100/100 exit 0、test: 372/372 pass

- 2026-03-11: #994 shape-plugin 冗長パイプライン状態変数削除・AbortControllerをPauseStateに統合・PR #995作成
  - activePipelines/activePipelineRuns/sessionAbortControllers/sessionWorkerInstances を削除
  - clearActivePipelineRuntimeState のクリア漏れバグ修正
  - AGENTS.md にSSOT原則追記
  - typecheck: 100/100 exit 0、test: 12/12 pass
  - sessionStartedAtをAUTH_REQUIRED通知に追加、UI側でキャンセル済みビルド試行を記録し重複抑制
  - AuthService.setBuildSessionContext/clearBuildSessionContextでセッション識別子伝播
  - typecheck: auth-api, auth, download, runtime-worker, shape-plugin, app 全通過
- 2026-03-10: #988 route-plugin t() String()ラップ + I18nInstance import整理・PR #990作成
  - t()戻り値をString()でラップ（route-plugin 6ファイル）、I18nInstance import簡素化（app 2ファイル）
  - tsconfig.typecheck.json に allowImportingTsExtensions追加
  - typecheck: 127/127 exit 0

- 2026-03-10: #986 shape-plugin DefaultTFuncReturn型エラー修正・PR #987マージ済み
  - t()戻り値をString()でラップ（5ファイル11箇所）
  - typecheck: shape-plugin exit 0（100/100 tasks successful）

- 2026-03-10: #984 OrResumeキーワード全廃・Startに統一・PR #985マージ済み
  - ファイル名・シンボル名・ログプレフィックスからOrResume除去（~19ファイル）
  - build: 67/67 exit 0

- 2026-03-10: #979 クールダウン中の再ビルド開始で認証ダイアログ非表示修正・PR #980作成
  - awaitAuthでAuthRequiredError throw、runStartBuildSessionでclearCancelledCooldown呼出追加
- 2026-03-10: #977 PluginDialogツールチップi18nキー不足修正・PR #978マージ済み
  - dialogs.pluginDialog.tooltips（7キー）+ buttons（minimize/restoreMinimized）を4ロケールファイルに追加
  - dialogs.pluginDraft.pluginDialog にも minimize/restoreMinimized を追加
  - typecheck: 80/80 exit 0

- 2026-03-10: #972 URL maximize時にプリセットサイズを使用するよう修正・PR #976マージ済み
  - hydration useEffectにmaximizeケース追加（getPresetSize/initialPosition使用）
  - typecheck: 80/80 exit 0

- 2026-03-10: #973 i18n bindI18nStore再レンダリング修正+common.basicInfoキー追加・PR #975マージ済み
  - bindI18nStore: '' → 'added removed' で非同期ロード完了時の再レンダリングを有効化
  - app/public/locales・locales の en/ja に common.basicInfo キーを追加
  - typecheck: exit 0

- 2026-03-10: #969 Gemini Code Assistレビュー指摘一括対応・PR #974マージ済み
  - AGENTS.md禁止パターン2文言修正、ResourceProjectPreviewGroup useNavigate実装
  - BuildStepPanel as string除去、useShapeBuildLabelsキー修正
  - useFloatingWindowController useMemoメモ化、LoadingButton functional setState化
  - useBuildProgressPanelStateSideEffects ref更新をuseEffectに移動
  - typecheck: 全対象パッケージ通過

- 2026-03-10: #966 Build*モジュールをcomponents→ui-build-progressに統合移動・PR #968作成
  - Build*コンポーネント/フック/型を移動、BuildSessionProgressPanelShell廃止
  - サブパスエクスポート移設、全プラグインのインポートパス更新
  - build: 114/114 ✅、typecheck: 144/147 ✅（route-plugin既知エラーのみ）

- 2026-03-10: #964 maximize状態でリサイズ/移動時にdisplayModeをnormalに自動遷移・PR #965マージ済み
  - レビュー指摘対応: nextDisplayMode変数導入でenforceTopLeftMargin条件を明確化・PR #967マージ済み

- 2026-03-10: #960 CommonDialogTitle表示モードtooltip/label i18n化・PR #962→#963マージ済み
  - DISPLAY_MODE_LABELSハードコード→t()化、IconButtonにTooltip追加、localeコピー同期
  - typecheck: exit 0、test: 5/5 passed

- 2026-03-10: #961 AGENTS.mdにReact Hooks依存配列ルール追加・PR #962マージ済み

- 2026-03-10: #958 useBuildProgressPanelStateSideEffects無限レンダリングループ修正・PR #959作成
  - totalElapsedSnapshotRef追加、elapsed snapshot useEffectからtotalElapsedSnapshot依存除去
  - typecheck: 新規エラー0件（既知DefaultTFuncReturn 15件のみ）

- 2026-03-10: #956 useShapeBuildStepStageState無限レンダリングループ修正・PR #957作成
  - tasksRef+tasksKey追加、persisted tasks同期useEffectから[tasks]依存除去→[tasksKey]に変更
  - typecheck: 新規エラー0件（既知DefaultTFuncReturn 15件のみ）

- 2026-03-10: #954 useLRUPanes無限レンダリングループ修正・PR #955マージ済み
  - panesRef追加、pane-sync/auto-expand useEffectからpanes依存除去
  - typecheck通過（exit 0）

- 2026-03-10: #952 "Close dialog"翻訳キー統合・ハードコード文字列i18n化完了・PR #953作成
  - dialogs.pluginDialog.tooltips.close → dialogs.common.actions.close に統一（PluginDialogControls/ArchiveDialog）
  - 死んだキー dialogs.archive.actions.close を全localeファイルから削除
  - AuthRequiredDialog.tsx ハードコード aria-label を t() に変更
  - PluginDialogStepper.tsx コンテキストメニュー3項目をi18n化
  - typecheck 143/147（route-plugin既知エラーのみ）

- 2026-03-10: #949 StableIconSlot無限レンダリングループ修正完了・PR #950マージ済み（height固定化・setMinWidth条件厳密化）

- 2026-03-10: #942 BFF認証切れ時のビルドセッション状態遷移修正完了・PR #943作成
  - AuthService cancelledUntilByScopeクールダウン実装
  - 状態遷移ドキュメントにSection 7.5追加
  - 死んだコード削除（authDialogOpen/closeAuthDialog/handleProviderSelect/TaskProgressAuthState）
  - PRレビュー対応: onAuthSuccessでsetToken追加・状態遷移ドキュメントのシーケンス更新
  - typecheck・build・test全通過確認
- 2026-03-10: #940 ナビゲーションコンポーネント抽出完了・PR #941マージ済み
- 2026-03-10: クリーンアップ: #937 worktree+ブランチ削除(Issue CLOSED済)、#913 ブランチ削除(Issue CLOSED済)、#914 main含有確認→Issue close+ブランチ削除
- 2026-03-10: #947 tsdown .d.ts分割問題修正完了・PR #948マージ済み（build-session再エクスポート削除・BuildStage/BuildStatus型追加・route-pluginインポートパス修正）
- 2026-03-10: #917 PR #945 mainリベース→CI全通過→マージ完了・ブランチ削除
- 2026-03-10: #944 PR #946マージ完了・ローカル/リモートブランチ削除・stash整理(3件drop)
- 2026-03-10: #917 mainリベース(コンフリクト2件解決)・push・PR #945作成
