# @hierarchidb/bff

最終更新: 2026-04-05

HierarchiDB の BFF（Backend for Frontend）サーバー。フロントエンドアプリケーションのバックエンドプロキシ・API 集約を提供する。

認証sessionは必須設定 `AUTH_SESSION_MODE=persistent|stateless` で選択します。`persistent` は
Cloudflare Workers KVの `AUTH_KV` bindingを使用してtoken refreshとサーバー側revokeを行います。
`stateless` はKVを使用せず、checked-in設定では4時間の短命JWT期限後に再ログインします。
namespaceの作成、環境別binding、検証、ロールバックは
[BFF `AUTH_KV` 運用仕様](./docs/auth-kv-operations.md)を参照してください。

意図した `stateless` ではKV警告を表示しません。`persistent` で `AUTH_KV` 未bindingまたは
KV操作失敗が発生した場合だけ、BFFは `kv_unavailable` 警告を返します。

## ライセンス

MIT
