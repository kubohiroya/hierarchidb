vk:doc kind=ref audience=dev scope=worker

# Error Codes（runtime-worker / Core 整流済み）

採用型: Core の `ErrorCode`

- NAME_NOT_UNIQUE: 名前重複
- STALE_VERSION: バージョン不一致（楽観ロック）
- HAS_INBOUND_REFS: 参照整合性違反
- ILLEGAL_RELATION: 違法な関係（循環等）
- NODE_NOT_FOUND: 対象ノードなし
- INVALID_OPERATION: 不正操作（未対応/禁止）
- UNKNOWN_ERROR: 不明な失敗
- WORKING_COPY_NOT_FOUND: WC 不存在
- COMMIT_CONFLICT: WC のコミット競合
- VALIDATION_ERROR: 入力不正（NAME_CONFLICT などを集約）
- DATABASE_ERROR: DB 操作失敗

マッピング指針
- CP ハンドラは Core `CommandResult` に準拠する。
- NAME_CONFLICT 相当は VALIDATION_ERROR とし、メッセージに suggestedName を含める。
- 例外は `createErrorResult(message, <適切な ErrorCode>)` で整流。

