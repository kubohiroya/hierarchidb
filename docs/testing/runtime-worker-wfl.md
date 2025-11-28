# Runtime Worker WFL シナリオ実行ガイド

cp-routing バッチフローの Worker-level 結合テスト（WFL）を CI / ローカル双方で安定的に実行するための手順です。テスト本体は `packages/runtime/worker/src/__tests__/wfl/cp-routing-wc.wfl.test.ts` に収録されています。

## 実行コマンド

```bash
# ワークスペース全体から runtime-worker-worker の WFL を実行
pnpm wfl --filter @hierarchidb/runtime-worker-worker

# あるいは個別に
pnpm --filter @hierarchidb/runtime-worker-worker wfl
```

内部では `vitest run src/__tests__/wfl/cp-routing-wc.wfl.test.ts` を呼び出し、Jest 互換の JUnit レポートを `reports/runtime-worker/cp-routing-wfl.xml` に出力します。CI で WARN / FAIL が発生した場合はこの XML を参照してください。

## レポートの確認

1. `reports/runtime-worker/cp-routing-wfl.xml` をテキストエディタや CI アナライザで開くと、テストケースごとのステータスとログ（`<system-out>`）が確認できます。
2. Vitest の標準出力もそのまま CI ログに流れるため、不整合が起きた場合は XML と併せて `pnpm --filter @hierarchidb/runtime-worker wfl` の再実行ログを見ると原因を特定しやすくなります。

## キャッシュと依存

- Turborepo タスク `wfl` は `turbo.json` に登録されており、上流の `build` が成功してから実行されます。
- キャッシュは無効化されているため、CI では毎回テストが実行されます。

## トラブルシュート

- **Dexie の `PrematureCommitError`**: テスト内で自動リトライを行います。頻発する場合は `packages/runtime/worker/src/services/CommandProcessor` 周辺のトランザクション設定を確認してください。
- **Fake IndexedDB のクリア失敗**: ローカルでブラウザを並行起動しているとステートが残る場合があります。`pnpm --filter @hierarchidb/runtime-worker wfl -- --runInBand` などで単独実行して解消できるか確認してください。

## 参考

- `packages/runtime/worker/package.json` — `wfl` スクリプト定義
- `turbo.json` — `wfl` タスクの依存関係
- `TASKS.md` — Route/Worker バッチ結合テスト整備タスクの進捗とロールバック手順
