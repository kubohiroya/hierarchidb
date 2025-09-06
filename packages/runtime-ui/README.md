# Runtime UI Packages

アプリ統合レイヤの UI パッケージ群（AppBar、SearchResultWindow など）。UI ライブラリと同様に、以下の規約を必ず守る。

## MUSTs
- 公開TSXの戻り値型: すべての公開 TSX は `JSX.Element`（必要なら `| null`）を明示する。
- 型エクスポート: `types` と `exports.types` は `src/index.ts` を指す（prebuild typecheck を安定化）。
- パスエイリアス禁止: 公開ソースで `~/` など tsconfig の paths に依存しない。相対参照のみ。
- React/MUI をバンドルしない: `peerDependencies` に置き、tsup `external` で除外する。
- 環境変数: `import.meta.env` / `VITE_*` を使用。`process.env` は使用しない。
- 依存解決: 他パッケージの `../src` 直参照は禁止。公開 API 経由、または d.ts 参照に限定する。

