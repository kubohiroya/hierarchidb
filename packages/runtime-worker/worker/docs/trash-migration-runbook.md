vk:doc kind=runbook audience=ops scope=worker

# Trash Migration Runbook (legacy → holder)

目的
- 既存の Trash（removedAt/original* 方式）を holder 方式へ安全に移行する。

準備
- Node >= 20, pnpm >= 9
- フラグは既定OFFのまま（`WORKER_TRASH_USE_HOLDER=0`）。移行後にONへ切替え可能。

手順
1) ドライラン
```
node -r esbuild-register packages/runtime-worker/worker/src/tools/trash-migrate.ts --dry-run --limit=100
```
- 出力: JSON（scanned/migrated/errors/durationMs/errorsByReason/details）
- 問題がなければ limit を段階的に上げる。

2) 本番実行（段階）
```
node -r esbuild-register packages/runtime-worker/worker/src/tools/trash-migrate.ts --limit=1000
```
- まずは小さな limit から。監視しながら増やす。

3) 切替
- `WORKER_TRASH_USE_HOLDER=1` を CI/Staging → 本番の順でON。

ロールバック
- 再度スクリプトを `--rollback` で実行（`--dry-run` で計画確認→実行）
```
node -r esbuild-register packages/runtime-worker/worker/src/tools/trash-migrate.ts --rollback --limit=1000
```

注意
- 競合: 同時に復元/削除が走ると、対象が見つからない場合がある（detailsに記録）。
- パフォーマンス: 大規模データでは limit を活用して段階移行。
