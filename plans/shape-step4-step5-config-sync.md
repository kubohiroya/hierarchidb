# Shape Step4 UI 追加と Step5 反映経路統一

この ExecPlan は生きた文書です。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` を作業の進行に合わせて更新してください。

本プランはリポジトリ直下の `PLANS.md` に従って維持される必要があります。

## Purpose / Big Picture

Shape の Step5 バッチ処理が Step4 の設定内容を正しく反映して実行されるようにします。さらに Step4 に不足している設定 UI を追加し、Tile の bufferSize を実処理へ反映します。ユーザは Step4 で入力した値をそのまま Step5 のビルドに反映でき、設定変更の結果が直感通りに反映される状態を確認できます。

## Progress

- [ ] (2025-12-20 19:30Z) ExecPlan を作成し、設計/実装/検証の流れを整理する。
- [ ] Step5 の開始経路を `startBatchProcessing` に統一し、Step4 設定値を渡せるようにする。
- [ ] Step4 の Download/Filter/Tile に不足 UI を追加し、入力方針（InputField/Slider/Rank）に従う。
- [ ] Tile の `bufferSize` を vector tile 生成処理へ反映する。
- [ ] 追加 UI の i18n を整備し、文言が翻訳可能であることを確認する。
- [ ] 検証コマンドを実行し、結果を運用ログに記録する（不可なら理由を記載）。

## Surprises & Discoveries

- Observation: Step5 は `WorkerBridge.startBatchSession('shape', nodeId)` を呼んでおり、Step4 の `processingConfig` を渡していない。
  Evidence: `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`

## Decision Log

- Decision: Step4 の設定 UI は InputField/Slider/Rank の方針に従い、以下の分類で追加する。
  Rationale: 仕様で定められた入力方針に従い、認知負荷を下げるため。
  Date/Author: 2025-12-20 / Codex

## Outcomes & Retrospective

未実施。

## Context and Orientation

Step4 の設定 UI は `plugins/shape-plugin/src/ui/components/steps/DownloadConfigSection.tsx`、`ExtractionConfigSection.tsx`、`VTConfigSection.tsx` で構成されています。Step5 は `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` で `WorkerBridge` を直接呼び出しています。バッチ処理の設定変換は `plugins/shape-plugin/src/worker/api.ts` の `startBatchProcessing` に集約されており、`ProcessingConfig` → `BatchProcessConfig` の変換がここで行われます。実処理は `plugins/shape-plugin/src/services/batch/SessionController.ts` が担当し、現在は固定値が多く設定されています。

## Plan of Work

まず Step5 の開始経路を `startBatchProcessing(draftId, config, urlMetadata)` に統一します。Step5 から WorkerBridge ではなく、shape plugin の worker API 経由で処理が開始できるように UI とワーカー側の呼び出し経路を整理します。これにより Step4 の `processingConfig` と `urlMetadata` がバッチ処理に渡るようになります。

次に Step4 の不足 UI を追加します。Download セクションに `timeoutMs`, `retryAttempts`, `retryDelay` を InputField で追加します。Filter（Extraction）セクションには `minVertexCountForAreaFilter`, `aspectRatioThreshold`, `hybridFilterConfig` の各項目、`quantize`, `enablePerFeatureExtraction` など、バッチ処理で必要な値を追加します。Tile セクションには `tileCountThresholdForZoomStop` や `zoomLevels` を追加します。入力方針として、論理的・分析的な実数値は InputField、感覚的な実数値は Slider、10 程度までの整数値は Rank を用います。

最後に Tile の `bufferSize` を `SessionController.processVectorTileStage` の生成パラメータへ反映します。Step4 の設定値が vector tile の処理設定に確実に引き渡される状態を作ります。

追加した UI は shape-plugin の i18n リソースに登録し、既存の `useTranslation` を通じて参照されるようにします。

## Concrete Steps

1) `ShapeBuildStep.tsx` の開始処理を `startBatchProcessing` 呼び出しへ切替し、`processingConfig` と `urlMetadata` を渡す。
2) `DownloadConfigSection.tsx` に `timeoutMs`, `retryAttempts`, `retryDelay` の入力 UI を追加する。
3) `ExtractionConfigSection.tsx` に不足パラメータの入力 UI を追加する。
4) `VTConfigSection.tsx` に `tileCountThresholdForZoomStop`, `zoomLevels` 等の入力 UI を追加する。
5) `SessionController.ts` で `bufferSize` を tile 生成設定へ反映する。
6) 追加 UI の文言を `plugins/shape-plugin/src/ui/locales/en.json` と `ja.json` へ追加し、i18n 参照に切り替える。

## Validation and Acceptance

`pnpm --filter @hierarchidb/shape-plugin typecheck` をリポジトリルートで実行し、exit 0 を確認します。UI では Step4 に追加した項目が表示され、値を入力すると Step5 の開始でその設定が使われることを確認します（ログや進捗の挙動で確認）。

## Idempotence and Recovery

差分は UI/worker/batch に局所化されるため、同じ手順を再実行しても問題ありません。問題が出た場合は該当差分を revert し、`pnpm --filter @hierarchidb/shape-plugin typecheck` を再実行してください。

## Artifacts and Notes

期待される設定反映の例:

  - Step4 の `bufferSize=512` を設定 → Step5 で vector tile 生成時のバッファサイズに 512 が使われる。

## Interfaces and Dependencies

- `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx`:
  Step5 の開始経路を `startBatchProcessing` に統一。
- `plugins/shape-plugin/src/ui/components/steps/DownloadConfigSection.tsx`:
  `timeoutMs`, `retryAttempts`, `retryDelay` を追加。
- `plugins/shape-plugin/src/ui/components/steps/ExtractionConfigSection.tsx`:
  Filter 系の不足パラメータ UI を追加。
- `plugins/shape-plugin/src/ui/components/steps/VTConfigSection.tsx`:
  Tile 生成の不足パラメータ UI を追加。
- `plugins/shape-plugin/src/services/batch/SessionController.ts`:
  `bufferSize` を vector tile 生成設定へ反映。
- `plugins/shape-plugin/src/ui/locales/en.json`, `plugins/shape-plugin/src/ui/locales/ja.json`:
  追加 UI 文言の i18n 登録。

Plan change note: 初版 ExecPlan を作成し、Step4 UI 追加と Step5 反映経路統一、bufferSize 反映を対象に設定。
