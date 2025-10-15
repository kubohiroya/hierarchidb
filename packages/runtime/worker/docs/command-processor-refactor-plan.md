# CommandProcessor リファクタリング計画（実装前整備）

本ドキュメントは、新機能（コマンドレジストリ、Undo/Redo 拡充 等）導入に先立ち、現行の CommandProcessor 周辺を安全に拡張できるようにするためのリファクタリングタスクを、なるべく独立的に整理したものです。各タスクは目的・範囲・手順・成果物・受け入れ基準・依存関係を明示します。

---

## タスク一覧（依存関係の概要）
- T1: 実行経路の一元化（CommandProcessor 経由へ集約）
- T2: ハンドラ方式へ移行（コマンドレジストリ導入）
- T3: エンベロープ整合（`kind/type` 整理・メタ統一）
- T4: エラーモデル統一（コード/例外→CommandResult）
- T5: イベント/ログの衛生化（サニタイズ/上限/構造化）

依存関係（推奨順）:
- T3, T4 は原則独立に先行実施可能
- T5 は T3, T4 完了後に着手推奨（ログ内容の整合性担保のため）
- T2 は T1 と並行して進められるが、最終切替は T1 完了後に実施
- T1 は段階的に進められる（まず主要 CRUD のみ集約 → 順次拡大）

---

## T1: 実行経路の一元化（CommandProcessor 経由へ集約）
- 目的: 書き込み系操作の入口を CommandProcessor に統一し、Undo/Redo・監査・制限の横断適用を可能にする。
- 範囲:
  - `TreeMutationService` 内の CRUD/移動/複製/貼り付け/インポート/ゴミ箱操作の実行経路を段階的に `processCommand` 経由に切替。
  - サービス内のローカル採番や結果生成（`getNextSeq` など）を撤去。
- 手順:
  1) `TreeMutationService` にフラグ（例: `useCommandPath`）を追加し、特定コマンドのみ `processCommand` 経由で実行できる分岐を仮導入。
  2) 主要 CRUD（create/update/move/remove）から順に `processCommand` 経路へ切替。
  3) 影響範囲の E2E/ユニットを実行し、非回帰を確認。
- 成果物: サービスの書き込み経路が CommandProcessor へ集約される差分。
- 受け入れ基準:
  - 既存ユースケースで動作・API は不変（結果/副作用/イベント発火順）
  - `processCommand` の呼び出しが主要 CRUD で確認できること
- 依存関係: なし（T2 と並行可）。ただし T3/T4 完了後のほうが後戻りが少ない。

---

## T2: ハンドラ方式へ移行（コマンドレジストリ導入）
- 目的: コマンド種別ごとに `validate/execute/undo/redo` を実装・登録し、保守性と拡張性を高める。
- 範囲:
  - `src/services/CommandProcessor.ts` の `executeCommand` 内のモック分岐を、レジストリ参照に段階置換。
  - 新規モジュール `command-registry`（仮）を追加：`type -> handler` マップ管理。
- 手順:
  1) ハンドラインターフェイス定義（`validate(payload)`, `execute(ctx)`, `undo(ctx)`, `redo(ctx)`）。
  2) 最小ハンドラ（`createNode`, `updateNode`, `moveNodes`, `removeNodes`）を実装してレジストリへ登録。
  3) `CommandProcessor` 側で、存在チェックを `isValidCommand` → レジストリ参照に変更。
- 成果物: レジストリ、最小ハンドラ群の実装、`executeCommand` の委譲化。
- 受け入れ基準:
  - 最小ハンドラで既存テストが通過
  - 未登録コマンドは `INVALID_OPERATION` で拒否
- 依存関係: T1 と並行可（最終切替は T1 の集約後に実施が安全）。

---

## T3: エンベロープ整合（`kind/type` 整理・メタ統一）
- 目的: コマンドエンベロープの表現を一貫化し、利用側/ログ/監査での解釈ブレを排除する。
- 範囲:
  - `CommandEnvelope` の `kind` を正規フィールドとし、`type` は後方互換のエイリアス（読み取り専用）に限定。
  - `commandId/groupId/correlationId/timestamp` の意味と必須性を明文化、型に反映。
- 手順:
  1) 型定義ファイル（`src/services/command-plugin-definition.ts`）で `type` を Deprecated 扱いに注釈し、`kind` の使用を強制。
  2) 生成系（`createEnvelope`）の出力を `kind` 基準に統一、`type` は自動同期のみ。
  3) 依存箇所の使用を `kind` に寄せる（検索置換＋型エラー修正）。
- 成果物: 統一されたエンベロープ仕様と型、最小限の呼び出し箇所の更新。
- 受け入れ基準:
  - 型チェック（`pnpm typecheck`）で `kind` ベースへ移行が確認できる
  - ログ/イベントで `kind` が一貫して記録される
- 依存関係: 独立実施可。T5 のログ整備と相性がよいので、T5 前に完了推奨。

---

## T4: エラーモデル統一（コード/例外→CommandResult）
- 目的: 例外・DB エラー・検証失敗を統一的に `CommandResult`（`success: false`）へマップし、呼び出し側と監査の解釈を一元化。
- 範囲:
  - `WorkerErrorCode` と Core 側 `ErrorCode` の相互マッピング定義。
  - ハンドラ/サービス層の失敗を `CommandResult` に正規化（スローは例外ケースのみ）。
- 手順:
  1) エラーアダプタを追加：`toWorkerErrorCode(error) -> {code, message}`。
  2) `processCommand` と各ハンドラの catch でアダプタ適用、統一 `CommandResult` を返却。
  3) 代表ケース（重名、循環、存在しないノード、DB 障害）の単体テスト追加。
- 成果物: 統一エラーレスポンス、エラーコードマッピング、テスト。
- 受け入れ基準:
  - 代表失敗ケースが期待どおりの `code` とサニタイズ済 `error` を返す
  - 例外スローは致命的ケースのみに限定
- 依存関係: 独立実施可。T5 のログ整備前に完了推奨。

---

## T5: イベント/ログの衛生化（サニタイズ/上限/構造化）
- 目的: 監査/デバッグに耐えるイベント記録を行いつつ、機密情報や過大データの流出・肥大化を防ぐ。
- 範囲:
  - `recordEventSafely` に `_sanitizeResultForLogging` を適用し、PII/大容量を含む可能性のある情報を記録しない。
  - `MAX_EVENT_HISTORY_SIZE` 等の上限値を厳格適用し、履歴をリングバッファで維持。
  - イベントに最低限のメタ（`commandId`, `groupId`, `kind`, `timestamp`, `durationMs`, `code?`）のみ保存。
- 手順:
  1) `recordEventSafely` を修正し、結果のサニタイズ・上限制御を導入。
  2) 可能であれば処理時間を計測して `durationMs` を付与。
  3) ロギング出力にも同サニタイズポリシーを適用（改行除去・長さ上限）。
- 成果物: サニタイズ済イベント履歴、抑制されたログ出力、設定値の実適用。
- 受け入れ基準:
  - イベント履歴にノード本文/説明等の機密が含まれない
  - 履歴サイズが上限を超えない（古いものから破棄）
  - 主要コマンド実行で `kind`/`commandId`/`groupId`/`durationMs` が確認できる
- 依存関係: T3, T4 完了後に着手推奨（イベント構造とエラーコードが安定してから）。

---

## 補足: 実施順の推奨例
1. T3（エンベロープ整合）と T4（エラーモデル統一）を並行で実施
2. T5（イベント/ログ衛生化）で観測基盤を確定
3. T2（ハンドラ方式）でレジストリ＋最小ハンドラ導入
4. T1（実行経路一元化）で CRUD から段階的に切替（フィーチャーフラグ併用）

これにより、API/イベントの契約が先に安定し、以降の機能拡張（Undo/Redo 拡充、複製/貼付け/インポート/ゴミ箱の完全対応）を安全に進められます。

