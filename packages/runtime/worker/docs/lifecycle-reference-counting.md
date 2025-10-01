vk:doc kind=guide audience=dev scope=worker

# Reference Counting (NodeLifecycleManager)

目的
- 一部のNodeTypeで参照整合（作成で増加・削除で減少）を扱うためのポート（拡張ポイント）を提供する。

実装手順
1) ハンドラ登録
```
nlm.setReferenceCountingRegistry({
  'folder': {
    async incrementReferenceCount(nodeId) { /* ... */ },
    async decrementReferenceCount(nodeId) { /* ... */ }
  }
});
```
2) NodeLifecycleManager は登録がある場合のみ呼び出す。未登録のNodeTypeはno-op（ログのみ）。

注意
- 現段階ではポートのみ。実装の要否はプラグイン側の要件次第。
- 将来的に registry 連携や型拡張を追加可能。

