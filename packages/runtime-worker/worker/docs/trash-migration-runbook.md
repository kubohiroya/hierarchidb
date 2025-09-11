vk:doc kind=runbook audience=ops scope=worker

# Trash Migration Runbook (legacy → holder)

目的
- 既存の Trash（removedAt/original* 方式）を holder 方式へ安全に移行する。

準備
- Node >= 20, pnpm >= 9
- 既定はON（`WORKER_TRASH_USE_HOLDER=1`）。レガシー互換が必要なケースのみ一時的にOFFへ切替え。

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
- 既定がONのため、特別な切替作業は不要。旧挙動が必要な場合のみ OFF に設定して検証。

ロールバック
- 再度スクリプトを `--rollback` で実行（`--dry-run` で計画確認→実行）
```
node -r esbuild-register packages/runtime-worker/worker/src/tools/trash-migrate.ts --rollback --limit=1000
```

注意
- 競合: 同時に復元/削除が走ると、対象が見つからない場合がある（detailsに記録）。
- パフォーマンス: 大規模データでは limit を活用して段階移行。
- メトリクス: durationMs と errorsByReason を活用し、異常の多い要因を特定する。
- ログ: `--dry-run` で想定対象を把握し、`--limit` を安全値から徐々に引き上げる。
