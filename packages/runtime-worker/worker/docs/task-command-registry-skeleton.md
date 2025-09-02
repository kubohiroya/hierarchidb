# タスク: 型安全コマンドレジストリ雛形の導入

目的
- `kind -> payload/result` を中央集約し、コンパイル時に不整合を検出する。
- any/キャストを排除し、ハンドラ実装の署名と `kind` の対応を型で保証する。

範囲（挙動変更なしの雛形導入）
- 型定義のみ追加（`CommandMap`, `CommandKind`, `PayloadOf`, `ResultOf`, `CommandEnvelope<K>`, `Handler<K>`, `Registry`）。
- `createEnvelope<K>()` の型安全なユーティリティを追加。
- 既存の `CommandProcessor.executeCommand` の実装は触らない（今後の置換準備）。

提案ファイル/配置
- `packages/runtime-worker/worker/src/services/command/registry.types.ts`
- `packages/runtime-worker/worker/src/services/command/envelope.util.ts`

仕様詳細
- CommandMap は当面コア種別のみ（createNode/updateNode/moveNodes/removeNodes）を定義。将来、重複/貼付け/インポート等を段階的に追加。
- `CommandEnvelope<K>` は `kind: K` による弁別共用体。`payload` は `PayloadOf<K>` で拘束。戻り値 `ResultOf<K>` を `Handler<K>` で拘束。
- `createEnvelope<K>()` は `kind` から `payload` 型を推論可能にし、誤った項目をコンパイル時に検出。

実施手順
1) 上記ファイルを追加し、最小限の CommandMap を定義。
2) 既存コードで `createEnvelope` を使用している箇所に型推論が効くことを確認（型テストでも可）。
3) 将来の移行用に、`CommandProcessor` からレジストリ参照に切替える TODO をコメントで明示。

受け入れ基準
- `pnpm typecheck` が通り、`kind` と `payload` の不整合を意図的に入れるとビルドが落ちることを確認。
- `switch(kind)` の網羅性チェックが `never` で機能する（型テスト）。
- 実行時の挙動は不変（ユニット/E2E 非回帰）。

依存関係
- なし（Zod 導入と並行可）。将来的に T2「ハンドラ方式」へ移行するための前提となる。

テスト方針
- 型テスト（`expectTypeOf` もしくは `tsd`）で CommandMap からの推論が意図通りであることを検証。
- コンパイル失敗を期待するケースはコメントアウトしてドキュメント化。

備考
- 既存の `@hierarchidb/common-type` をソースに据え、ID/NodeType などのブランド型を活用する。

