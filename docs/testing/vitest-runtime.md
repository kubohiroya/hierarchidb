# Vitest Runtime ガイド（Node 環境）

更新日: 2025-09-26

このメモは `vitest.setup.base.ts` の共通セットアップが Node.js 上でテストを実行する際に満たしている要件と、追加ポリフィルを導入するときの指針をまとめたものです。

## 1. fetch ポリフィルの方針

- Node.js 20 系では `globalThis.fetch` が実装されていますが、サンドボックスや古い LTS を使った CI では未定義のケースがあります。
- 2025-09-26 時点での実装は `node:undici` を動的 import し、`fetch` / `Headers` / `Request` / `Response` / `FormData` / `Blob` / `File` をグローバルへ割り当てる構成です。
- `node:undici` の import に失敗した場合は警告を出しつつ未定義のままにする設計です。原因切り分け時は `undici` のバージョンや Node.js バージョンを確認してください。

### 1.1 ユースケース

| ケース | 対応 | 備考 |
| --- | --- | --- |
| fetch 未定義 | 自動で `node:undici` を import して割り当て | `vitest.setup.base.ts` の非同期 IIFE で実行 |
| `headers.append` などの型差異 | `node:undici` 提供のクラスを優先使用 | 必要に応じて個別テストで shim を追加 |
| 追加 API（`FormData`/`File`） | `undici` 側で提供されていない場合のみ既存グローバルを維持 | DOM 系 polyfill を二重定義しないためのガード |

### 1.2 代替戦略

- どうしても `undici` が利用できない環境では `node-fetch` など別実装を追加し、`applyFetchPolyfill` ヘルパーへ渡す形で拡張できます。
- `vitest.setup.base.ts` に `applyFetchPolyfill(customImpl)` を呼び出すスニペットを追加する場合は、既存の `node:undici` 部分を置き換えるのではなく、フォールバックの `catch` 節で試すようにしてください。

## 2. 既知の依存関係

- IndexedDB: `fake-indexeddb/auto`
- Worker 環境: シンプルな `WorkerMock`
- crypto API: `globalThis.crypto.subtle` を簡易モック
- その他 DOM API: `URL.createObjectURL`, `structuredClone`, `CompressionStream`

これらは `vitest.setup.base.ts` で一括定義されています。個別パッケージで独自モックを追加する場合は、`vitest.setup.ts` から import される順序に注意し、重複定義を避けてください。

## 3. トラブルシューティング

1. **fetch が未定義のままになる**
   - Node.js のバージョンと `undici` の import 可否を確認する
   - `console.warn('[vitest.setup.base] Failed to polyfill fetch via node:undici', error);` の出力内容を確認する
   - サンドボックス環境では `node:undici` が制限されていないか確認する

2. **`TypeError: Response is not a constructor`**
   - 他のテストで `globalThis.Response` を上書きしていないか確認する
   - `applyFetchPolyfill` で `Response` が `undici` から提供されていることを検証する

3. **Blob/File を使うテストが失敗する**
   - Node.js が `Blob`/`File` をネイティブ提供している場合はそのまま利用します。`undici` 側に実装がない場合は既存グローバルを保持するため、必要に応じて individual テストで `@web-std/file` などをインラインで import してください。

## 4. 部分的に Vitest を実行する手順

アプリケーション配下 (`/app`) のテストだけを素早く検証したい場合は、新設した `app/vitest.config.ts` を利用できます。ルートで下記を実行すると、`~` や `@hierarchidb/plugin-registry` エイリアス、`node-fetch` スタブなどが自動適用された状態で対象ファイルのみを走らせられます。

```bash
# 例: plugin-presentation と worker-runtime のテスト群のみ実行
pnpm -C app test -- --run app/src/services/__tests__/plugin-presentation.test.ts
```

`--run`/`--include` にパスを列挙すれば複数ファイルをまとめて実行できます。アプリ以外のパッケージを含む全体テストを行いたい場合は、従来どおりルートの `vitest.config.ts` を使用した `pnpm test` または `pnpm --filter <pkg> test` を利用してください。

---

> 補足: このガイドは `TASKS.md` の `fix/test-env/fetch-polyfill` タスクと連動しています。追加のポリフィルやサードパーティ依存を導入した場合は、このファイルに手順と理由を追記し、再発防止に役立ててください。
