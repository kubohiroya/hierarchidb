# Envelop検証におけるZod導入

本ドキュメントは、Command Envelope に対する最小限の入力検証を Zod で導入する計画をまとめたものです。実装は段階的に行い、既存の実行経路・型定義との後方互換性を維持します。

## 目的 / 非目的（範囲）
- 目的:
  - Envelope の必須項目の存在と型の検証
  - 主要文字列フィールド等の上限（長さ・サイズ）検証
  - `kind` と `type`（後方互換 alias）の片方以上が妥当であることの検証
  - `payload` は “存在のみ” を確認（shape 検証は実施しない）
- 非目的（今回対象外）:
  - 個別コマンドの `payload` 深いスキーマ検証（各サービス/レジストリ側で実施予定）
  - ビジネスロジック/権限/参照整合性の検証
  - 永続化層/イベント履歴の仕様変更

## 対象フィールドと検証ポリシー
- 必須: `commandId`・`groupId`・`issuedAt`・`payload`・`(kind | type)`
- 上限（上位バウンド）: 文字列長、ID形式の粗い制限、エラーメッセージ長
  - `commandId`/`groupId`: 1〜100 文字（UUID を想定しつつ厳密正規表現は当面回避）
  - `kind`/`type`: 1〜64 文字（ASCII 英数・ダッシュ/アンダースコアを想定）
  - `sourceViewId`: 最大 128 文字
  - `onNameConflict`: 列挙 `'error' | 'auto-rename'`
  - `issuedAt`: number（UNIX ms）
  - `payload`: 任意型（存在のみ必須／サイズ制限はログ出力時のサニタイズで対応）
- 後方互換: `kind` が無い場合は `type` を受け入れ、検証時に `kind` に正規化（コード側適用時の方針）。
- 追加フィールド許容: 既存の互換性維持のため、未知フィールドは削除せず無視。

関連コード参照:
- `packages/runtime-worker/worker/src/services/command-types.ts`
- `packages/runtime-worker/worker/src/services/CommandProcessor.ts`

## タスク一覧（ZE-1 〜 ZE-5）

- ZE-1 依存追加と最小雛形
  - 内容: `zod`（必要なら `zod-validation-error`）をワークスペースに追加。`Envelope` 検証の最小雛形関数を作成（返り値は Result 型 or 例外）。
  - 成果物: `packages/runtime-worker/worker/src/services/validation/envelope.ts`（案）に雛形。`pnpm test` がグリーン。
  - 受け入れ基準: 型安全で import 可能、まだ実行経路へは未適用。

- ZE-2 Envelope スキーマ定義
  - 内容: 上記ポリシーに従った Zod スキーマ実装。`kind|type` の片方必須・長さ制限・列挙・数値型の検証を実装。検証後の正規化（`type`→`kind`）をユーティリティで提供。
  - 成果物: `createEnvelopeSchema()`・`validateAndNormalizeEnvelope(envelope)` の提供。
  - 受け入れ基準: 境界値テスト（長さ/未定義/型不一致）が揃っていること。

- ZE-3 processCommand 入口での検証適用
  - 内容: `CommandProcessor.processCommand` の冒頭に、ZE-2 の `validateAndNormalizeEnvelope` を適用。失敗時は早期 return（`success: false, code: VALIDATION_ERROR`）。
  - 成果物: 入口一箇所での横断適用。`payload` は深掘りしない。
  - 受け入れ基準: 既存テストが壊れない・後方互換の `type` のみでも通る。

- ZE-4 失敗時の整流とログサニタイズ
  - 内容:
    - 検証エラーのエラーメッセージを最大 200 文字に制限し、ログインジェクション対策（改行・制御文字の除去）。
    - エラーログには `payload` を出さない。`commandId` 等は長さ制限内にトリムして出力。
    - 例外→`VALIDATION_ERROR` に正規化するエラーマッピングを追加。
  - 成果物: `CommandProcessor` のログ/イベント履歴は機密データを含まない。
  - 受け入れ基準: ログ/イベントに `payload` が含まれないことをテストで確認。

- ZE-5 ユニットテスト
  - 内容:
    - スキーマ単体テスト（成功/失敗/境界値）。
    - `processCommand` 統合テスト（正常系/`type`→`kind` 正規化/失敗系）。
    - ログサニタイズの検証（`payload` 不出力・メッセージ長）。
  - 成果物: `packages/runtime-worker/worker/src/services/validation/__tests__/envelope.test.ts` ほか。
  - 受け入れ基準: `pnpm test` グリーン。既存 E2E に影響なし。

## 適用ポイントと実装方針
- 適用ポイント: `CommandProcessor.processCommand` の入口一箇所で適用（横断関心事）。
- 正規化方針: 検証成功時に `type` のみ→`kind` を補完（内部処理は `kind` に統一）。
- 互換性: 既存の envelope 生成ユーティリティ（`createEnvelope`）や各サービス呼び出しは変更不要を目指す。

## 失敗時の整流とログサニタイズ
- エラーコード: `WorkerErrorCode.VALIDATION_ERROR` を返却。
- メッセージ: 最大 200 文字、制御文字除去、詳細は開発ログのみ（本番は要マスク）。
- ログ出力方針:
  - `payload` はログ・イベント履歴に含めない。
  - ID/文字列は上限制限・トリム後に出力。
  - エラーオブジェクトはサニタイズ関数経由で文字列化。

## 依存関係と推奨順（T4/T5 との整合）
- 参考タスク:
  - T4: NodeTypeRegistry 実装（docs/tasks/worker-implementation-tasks.md）
  - T5: 基本的な WorkerAPI 構造（同上）
- 推奨順:
  1) ZE-1/ZE-2 を先行（スキーマとユーティリティは独立実装可）
  2) T5 により Command 経路が固まった後に ZE-3 を適用（入口一箇所で安全に差し込み）
  3) ZE-4/ZE-5 を仕上げとして導入（ログ方針とテストの整合性確保）
- 整合ポイント:
  - T4 の NodeTypeRegistry（プラグイン）は payload の詳細検証を担う可能性があるため、本計画では Envelope のみを担当し、責務が重複しないよう分離。
  - T5 の WorkerAPI 初期化/DI の影響を受けないファイル配置（`validation/` ディレクトリ）にする。

## 成果物サマリ
- 新規: `packages/runtime-worker/worker/src/services/validation/envelope.ts`（スキーマ/検証関数）
- 変更: `CommandProcessor.processCommand`（入口検証・エラーマッピング・ログサニタイズ）
- テスト: `packages/runtime-worker/worker/src/services/validation/__tests__/envelope.test.ts`、`CommandProcessor` 統合テスト補強

## リスクと回避策
- 既存呼び出しの破壊的変更リスク → `type`→`kind` 正規化で後方互換維持、未知フィールドは許容。
- パフォーマンス低下 → 検証は軽量（Zod）・1 箇所適用。必要に応じて dev/prod で詳細度スイッチ。
- ログ過多/情報漏洩 → 既存のサニタイズ機構を流用し、payload 非出力を徹底。

## 次の拡張（将来）
- 各コマンド毎の payload スキーマを NodeTypeRegistry/Command Registry 側に集約。
- 監査ログ向けの安全なダイジェスト（payload ハッシュ）出力の検討。
- バリデーション結果を型に反映（refine で brand 付与）し、中間表現として渡す設計の検討。
