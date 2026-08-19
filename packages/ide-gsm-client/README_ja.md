# @hierarchidb/ide-gsm-client

最終更新: 2026-08-19

`docs/yaml-plugin-ide-gsm-step4-spec.md` が固定する IDE-GSM frontend API 向けの typed GraphQL client。

## YAML Step 4 command

`IdeGsmClient.executeCommand()`は、canonicalな20 commandを完全列挙したdiscriminated union
`IdeGsmCommand`を受け取る。各commandはupstream mutation 1件だけに対応する。unknown command、
不正なproject path、不正なrsync connection typeはnetwork request前に失敗し、aliasや別mutationへの
fallbackは行わない。

rsync inputは`connectionType`とoptionalな`include` / `exclude`配列を使用する。未指定の配列を
空配列で補完しない。`init`はupstream bootstrap mutationを直接呼び、`importProject`を前置しない。

`awaitTask(taskId, onStatus?)`はpinned upstreamの7 statusを検証する。`REGISTERED`、`READY`、
`LEASED`では購読を継続し、`FINISHED`だけを成功とする。`FAILED`、`CANCELED`、`DELETED`、
malformed event、unknown status、task ID不一致、terminal前の購読終了は失敗として購読を閉じる。
検証済み更新は`id`、`status`、`paramsJson`、`resultJson`を公開する。

endpointとcredentialはrequest認証のためclient instance内だけに保持する。URL、log、Web Storage、
IndexedDBへ保存せず、transport errorにもraw endpointやcredentialを含めない。

## 依存関係

- `graphql-request`
- `graphql-ws`
- peer: `graphql`

## 関連パッケージ

- [`@hierarchidb/simulation-workflow`](../simulation-workflow/) — シミュレーションワークフロー

## ライセンス

MIT
