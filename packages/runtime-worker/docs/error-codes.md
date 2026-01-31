vk:doc kind=ref audience=dev scope=worker

# Error Codes（runtime-worker / Core 整流済み）

採用型: Core の `ErrorCode`

## エラーコード一覧

| Code | 概要 | 代表シナリオ |
| --- | --- | --- |
| `NAME_NOT_UNIQUE` | 名前衝突（フォルダ・ノード名が重複） | rename/move/duplicate 時の `auto-rename` 無効ケース |
| `STALE_VERSION` | 楽観ロック不一致 | 将来の Versioned API 用（現在は reserve） |
| `HAS_INBOUND_REFS` | 参照整合性違反 | 参照先が存在するノードの削除 |
| `ILLEGAL_RELATION` | 違法な関係（循環など） | 自己参照を作る貼り付け |
| `NODE_NOT_FOUND` | 目的ノード不存在 | TreeQuery/Mutation で対象が見つからない |
| `INVALID_OPERATION` | 不正操作（未対応/禁止） | レガシー API やポリシー違反 |
| `UNKNOWN_ERROR` | 不明な失敗 | 予期せぬ例外のフォールバック |
| `WORKING_COPY_NOT_FOUND` | WC 不存在 | DraftService で holder/metadata が欠落 |
| `COMMIT_CONFLICT` | WC コミット競合 | version advance / concurrent commit |
| `VALIDATION_ERROR` | 入力不正 | Zod/handler validate or name conflict |
| `DATABASE_ERROR` | Dexie/IndexedDB 失敗 | ConstraintError, BulkError 等 |

## 整流ポリシー

- CommandProcessor/TreeMutationService は `classifyWorkerError()` / `sanitizeMessageText()` によって例外を `CommandResult` へ正規化する。
- エラーメッセージは改行・タブをスペース化し、`PERFORMANCE_CONFIG.MAX_ERROR_MESSAGE_LENGTH`（200 文字）で切り詰める。
- `CommandResult.success === false` の場合でも `seq` は採番され、監査ログ (`CommandHistoryManager`) ではサニタイズ済みメッセージのみ保持する。

## 分類ルール（classifyWorkerError）

1. 例外 (`error.code` / `error.errorCode`) が `WorkerErrorCode` と一致する場合はそれを採用。
2. 例外名に応じたマッピング
   - `ConstraintError` / `BulkError` / `DexieError` / `InvalidStateError` → `DATABASE_ERROR`
   - `ZodError` / `ValidationError` → `VALIDATION_ERROR`
3. メッセージヒューリスティック
   - `working copy` → `WORKING_COPY_NOT_FOUND`
   - `name conflict`/`already exists` → `NAME_NOT_UNIQUE`
   - `commit conflict`/`version conflict` → `COMMIT_CONFLICT`
   - `validation`/`invalid` → `VALIDATION_ERROR`
   - `not found` → `NODE_NOT_FOUND`
   - `dexie`/`indexeddb`/`database`/`constraint` → `DATABASE_ERROR`
4. 上記条件に該当しない場合はフォールバック（呼び出し元既定で `UNKNOWN_ERROR`）。

## ハンドラ実装指針

- CP ハンドラ内で失敗を返す場合は `createErrorResult(message, code)` を使用し、`message` は前述のサニタイズに任せる。
- NAME_CONFLICT 等の UI 追加情報は `status` / `suggestedName` / `originalVersion` / `wcVersion` で補足し、`CommandResult` に含める。
- 例外スローは致命的ケース（ロジックバグや Dexie が wrap できない失敗）に限定し、最終的に `classifyWorkerError` が安全な `CommandResult` として呼び出し側・ログへ返る。
