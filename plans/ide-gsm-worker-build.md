# IDE-GSM 取込/解析/保存を Worker 実行へ移行し、Step5 で進捗可視化する

本 ExecPlan は生きたドキュメントであり、Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を常に更新する。作業はリポジトリ直下の PLANS.md に従って進めること（PLANS.md を参照）。

## Purpose / Big Picture

IDE-GSM を選択したときのタビュラーファイルの読み込み・解析・Dexie 保存が UI スレッドで止まらず、Worker 側で実行されるようにする。Step5 の画面で、読み込み・解析・保存の進捗が逐次表示される状態を作る。ユーザーは大きな CSV でも UI が固まらず、進捗バーが動くことを確認できる。

## Progress

- [x] (2025-12-26 19:30 JST) ExecPlan の作成と、対象コードの現状把握を完了する。
- [x] Worker API に IDE-GSM 取込処理と進捗通知を追加し、location/route で共通化できる形にする。
- [x] location-plugin の Step5 を Worker 実行へ切替え、進捗 UI を反映する。
- [x] route-plugin の Step5 を Worker 実行へ切替え、進捗 UI を反映する。
- [ ] テスト/手動確認を実施し、運用ログへ結果を記録する。

## Surprises & Discoveries

- Observation: 未記入。
  Evidence: 未記入。

## Decision Log

- Decision: Worker 実行の進捗通知は Comlink 経由のコールバック関数で実装する。
  Rationale: Batch API が shape 専用のため、最小差分で Step5 進捗を可視化できる手段が必要。
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

- 未記入（完了時に記録）。

## Context and Orientation

IDE-GSM は location/route の DataSource で、現在は UI が `authFetch` と CSV 解析を行い、Dexie に保存している。location は `plugins/location-plugin/src/ui/components/steps-provider.tsx` 内の `startLocationBatch` が IDE-GSM のダウンロード・解析・保存を行う。route は `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` 内で IDE-GSM を取得し `RouteDatabase` に保存している。どちらも UI スレッドでの処理のため、行数が多い場合にフリーズする。

Worker 側の API は `packages/common/api/src/WorkerAPI.ts` のインターフェースに従って `app/src/worker-runtime/worker.ts` の Comlink で公開される。Location/Route の Worker API 実装は `packages/runtime-worker/src/services/LocationMutationService.ts` と `packages/runtime-worker/src/services/RouteMutationService.ts` にある。UI 側は `packages/ui/worker-client/src/workerBridge.ts` の API を利用して Worker と通信する。進捗 UI は Step5 の各 BuildStep（location: `plugins/location-plugin/src/ui/components/steps/LocationBuildStep.tsx`, route: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`）で表示する。

本タスクでは、IDE-GSM の読み込み・解析・保存を Worker 側に移し、bulkPut のチャンク保存でメモリ負荷を抑え、進捗を UI に逐次通知する。進捗は「download / parse / save」などのフェーズ名と、処理済み件数を表示する。

## Plan of Work

まず location/route の IDE-GSM 処理を UI から外し、Worker API に移す。Worker API には「IDE-GSM 取込」を行うメソッドを追加し、進捗イベントをコールバックで UI に送る。location 側の CSV 解析ロジックは `steps-provider.tsx` 内に閉じているため、Worker でも使える共有モジュール（例: `plugins/location-plugin/src/services/ide-gsm/ideGsmCsv.ts`）へ移動し、依存関数（国コード解決、管理区分の解決、CSV パース）も同じモジュールへ集約する。route 側は既に `plugins/route-plugin/src/services/ide-gsm/ideGsmCsv.ts` があるため、Worker から呼べる形で再利用する。

location の Worker 側処理は `LocationMutationService` に追加し、以下を行う。1) `sourceUrl` の fetch（Worker で `authFetch` 相当が必要なら `@hierarchidb/download` か Worker 側ユーティリティを使う）、2) CSV の解析、3) 選択条件（国/タイプ）でフィルタ、4) Dexie への chunked bulkPut（`LocationEntitiesDB` または storeRegistry 経由）を行う。進捗は 0-100 の割合と、処理行数、保存行数などをコールバックで通知する。UI 側は `startLocationBatch` から Worker メソッドを呼び、Step5 で進捗を表示する。

route の Worker 側処理は `RouteMutationService` に追加する。Location のインデックス作成は `LocationQueryAPI` を Worker 内で利用し、CSV 解析は `ideGsmCsv.ts` を使う。Dexie 保存は `RouteDatabase` に chunked bulkPut を使う。進捗イベントは location と同じ形で通知し、`RouteBuildStep` の進捗表示に連携する。

UI 側は Step5 で Worker 実行中の進捗を表示し、完了したら従来のステータス更新（processingStatus 等）を反映する。エラーは Worker から UI に伝え、既存のエラーダイアログまたは通知に合わせる。

## Concrete Steps

1. `packages/plugin-service-api/src/types/LocationMutationAPI.ts` と `packages/plugin-service-api/src/types/RouteMutationAPI.ts` に IDE-GSM 取込メソッドを追加する。進捗は `onProgress` コールバックを引数で受ける形にする。
2. `packages/runtime-worker/src/services/LocationMutationService.ts` と `packages/runtime-worker/src/services/RouteMutationService.ts` に実装を追加する。location は CSV 解析ロジックを Worker 用に移動する。route は `ideGsmCsv.ts` を利用する。
3. Worker から必要なユーティリティが使えるように、location 側の CSV パース/国コード/管理区分解決の処理を `plugins/location-plugin/src/services/ide-gsm/` へ移動し、UI と Worker から共有する。
4. UI 側の `plugins/location-plugin/src/ui/components/steps-provider.tsx` と `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` を更新し、Worker API を呼び出す。進捗コールバックで Step5 の進捗表示を更新する。
5. Step5 の進捗表示は既存の BuildStepPanel を流用し、進捗割合とフェーズ名を表示する。必要なら新しいステージ定義（例: `ide-gsm-import`）を追加する。
6. 変更後、`pnpm --filter @hierarchidb/location-plugin test` と `pnpm --filter @hierarchidb/route-plugin test` を実行し、結果を TASKS.md に記録する。

## Validation and Acceptance

location/route の Step5 で IDE-GSM を選択し、ビルド開始時に UI が固まらず進捗が表示されることを確認する。進捗は「download / parse / save」などのフェーズ名を表示し、件数が増えるにつれて更新される。処理完了後に Dexie に保存済みデータが確認でき、プレビューに反映されること。

## Idempotence and Recovery

IDE-GSM の取込は nodeId 単位で既存データを置き換えるため、再実行しても同じ状態に戻る。失敗時は Worker API の追加部分と UI 呼び出しを revert すれば元の UI 実装に戻る。

## Artifacts and Notes

未記入（実装後にテストログや簡単な進捗ログを貼る）。

## Interfaces and Dependencies

Worker API の追加は `LocationMutationAPI` / `RouteMutationAPI` に行い、`packages/runtime-worker/src/services/*MutationService.ts` に対応する実装を追加する。進捗通知は Comlink で UI に渡すコールバック関数とし、UI は `packages/ui/worker-client/src/workerBridge.ts` 経由で呼び出す。bulkPut は Dexie の `bulkPut` をチャンク単位で使用し、チャンクサイズは 500〜2000 の範囲で安全な値を選ぶ。CSV 解析は location 側で新設する `plugins/location-plugin/src/services/ide-gsm/ideGsmCsv.ts` に集約し、route は既存の `plugins/route-plugin/src/services/ide-gsm/ideGsmCsv.ts` を使用する。

--- 
Plan Revision Note: 2025-12-26 JST に初版を作成。IDE-GSM の Worker 移行と進捗可視化のための作業計画を明文化した。
