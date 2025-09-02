# Zod 薄い導入計画（Envelope 限定）

本ドキュメントは、Zod を「Command Envelope の最小ランタイム検証」に限定して導入するための実施計画です。型安全（コンパイル時）を最優先としつつ、実行時の境界（Comlink/Worker）で最低限の不正入力を早期検出・整流することを目的とします。

---

## 目的と非目的
- 目的（Scope）
  - CommandEnvelope（`commandId/groupId/kind/issuedAt/meta?`）の必須項目と上限値の検証を `processCommand` 入口で実施。
  - 検証失敗は `success:false + code: VALIDATION_ERROR` で一貫して返す（メッセージはサニタイズ）。
  - 型定義は既存の `@hierarchidb/common-api`/`@hierarchidb/common-type` を継続利用し、スキーマから `z.infer` を使う場合でも型の二重管理を避ける（段階導入）。
- 非目的（Out of Scope）
  - コマンドごとの payload 検証（paste/import/duplicate など）は本フェーズの対象外。
  - ドメイン/DB レイヤの詳細な整合性検証は従来どおり（既存の手書き検証に委譲）。

---

## タスク一覧（ZE-*）と依存関係
- ZE-1: 依存追加と最小スキーマ雛形の作成（独立）
- ZE-2: Envelope スキーマの定義とユーティリティ公開（独立）
- ZE-3: `processCommand` 入口での検証適用（T4: エラーモデル統一 完了推奨）
- ZE-4: 検証失敗時の整流とログのサニタイズ強化（T5: イベント/ログ衛生化 と整合）
- ZE-5: ユニットテスト追加（独立、ただし ZE-3 に従属）

推奨順序: ZE-1 → ZE-2 → ZE-3 → ZE-4 → ZE-5

---

## ZE-1: 依存追加と最小雛形
- 目的: Zod を導入し、Envelope 用の最小スキーマを追加できる土台を用意。
- 手順:
  - `pnpm add zod`（ワークスペース共通 or worker パッケージローカル）。
  - 追加ファイル（候補）: `src/services/validation/envelope.schema.ts`
- 成果物:
  - Zod 依存が追加され、ビルドが通ること。
- 受け入れ基準:
  - `pnpm build`/`pnpm typecheck` が成功。
- 依存: なし。

---

## ZE-2: Envelope スキーマ定義
- 目的: 必須フィールド・上限・簡易正規化（既定値）を宣言的に定義。
- 実装方針:
  - 制限は `PERFORMANCE_CONFIG` に合わせる（例: `MAX_COMMAND_ID_LENGTH`）。
  - 既定値は必要最小限（例: `meta.correlationId` 未指定なら空扱い。自動採番は `createEnvelope` 側の責務）。
- 例（雛形）:
  ```ts
  import { z } from 'zod';
  export const EnvelopeSchema = z.object({
    commandId: z.string().min(1).max(100),
    groupId:   z.string().min(1),
    kind:      z.string().min(1),
    issuedAt:  z.number().int().positive(),
    payload:   z.unknown(), // 本フェーズでは深入りしない
    meta: z.object({ correlationId: z.string().optional() }).optional(),
  });
  export type EnvelopeInput = z.infer<typeof EnvelopeSchema>;
  ```
- 成果物:
  - `EnvelopeSchema` の公開と再利用ユーティリティ（`validateEnvelope(env)`）。
- 受け入れ基準:
  - スキーマ変更が型崩れを起こさない（`z.infer` を必要に応じて使用）。

---

## ZE-3: `processCommand` 入口での検証適用
- 目的: Worker 境界で実行時検証を実施し、不正入力を早期遮断。
- 実装ポイント:
  - `processCommand` 冒頭で `EnvelopeSchema.safeParse(envelope)` を実行。
  - 失敗時は `WorkerErrorCode.VALIDATION_ERROR` で `CommandResult` を返す（例外は投げない）。
  - エラーメッセージは既存の `sanitizeErrorMessage` か同等の処理でサニタイズ。
- 擬似コード:
  ```ts
  const parsed = EnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    return this.createErrorResult(
      sanitize(parsed.error.message),
      WorkerErrorCode.VALIDATION_ERROR
    );
  }
  ```
- 成果物:
  - 入口での一貫した検証と、失敗時の整流。
- 受け入れ基準:
  - 不正な `commandId/kind/issuedAt` を含む Envelope が DB/Undo スタックに到達しない。
- 依存: T4（エラーモデル統一）完了が望ましい（コード整流の一貫性）。

---

## ZE-4: 検証失敗時の整流とログサニタイズ
- 目的: 運用ログ/イベントから機密や過大情報を排除しつつ、原因特定に十分な情報を残す。
- 実装ポイント:
  - `recordEventSafely` で結果サニタイズを適用（payload は保存しない）。
  - Envelope 検証失敗はイベント履歴に「型名/フィールド名/上限違反等」の最小限メタのみ記録。
- 成果物:
  - 一貫したサニタイズされたイベントとログ出力。
- 受け入れ基準:
  - 失敗時も個人/機密データが履歴・ログに残らない。
- 依存: T5（イベント/ログ衛生化）と整合。

---

## ZE-5: ユニットテスト
- 目的: 代表的な不正 Envelope を網羅し、早期検出と整流を保証。
- テスト観点:
  - `commandId` 空/過長、`kind` 空、`issuedAt` 未指定/負値、`groupId` 空。
  - 失敗時の `code === VALIDATION_ERROR`、メッセージがサニタイズ済み。
  - 正常系では既存の `processCommand` 挙動に影響がないこと。
- 成果物:
  - `src/services/__tests__/envelope-validation.test.ts`（例）。
- 受け入れ基準:
  - `pnpm test` 合格、既存テストに回帰なし。

---

## ロールアウトとリスク
- ロールアウト:
  - フィーチャーフラグ（例: `ENABLE_ENVELOPE_VALIDATION`）を設け、段階的に有効化。
  - 先行はログ WARN のみ → 期間後に HARD FAIL（VALIDATION_ERROR）へ昇格。
- リスク/対応:
  - 既存呼び出しの微妙な不整合で弾かれる可能性 → 先行期間で検出・修正。
  - 実行オーバーヘッドは極小（DB I/Oに比して無視可能）だが、ホットパスにならないよう注意（1回/コマンド）。

---

## 受け入れ基準（全体）
- Envelope の不正形が `processCommand` で一貫して `VALIDATION_ERROR` に整流される。
- Undo/Redo/DB 操作の前に不正が遮断され、スタックや DB の整合を乱さない。
- ログ/イベントがサニタイズされ、機密や payload 本文を保存しない。
- 既存の呼び出しは影響なく（正常系）、テストはすべて合格。

---

## 将来拡張（参考）
- 高リスクコマンド（paste/import/duplicate）へのスキーマ拡張。
- レジストリ登録時の `schema` 必須化（未定義ハンドラの禁止）。
- `z.infer` を一次ソースにする共通スキーマパッケージ（`@hierarchidb/common-schema`）の新設。

