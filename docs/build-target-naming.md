# Turbo ビルドターゲット命名ガイド

本ドキュメントは HierarchiDB ワークスペース全体で使用するビルド関連ターゲットの命名規約を定め、Turbo から一貫したパイプライン制御ができるようにするための指針です。

## 基本方針

- **build**: パッケージの完全な成果物（JS/ワーカー/分割 bundle など）と型定義を生成するエントリーポイント。既存の `pnpm --filter <pkg> run build` 呼び出しはこのターゲットに統一する。
- **build:types**: `.d.ts` のみを生成するタスク。tsup/tsc/API Extractor など型出力に特化したコマンドを実行し、Turbo 上では `build:bundle` の前提条件とする。
- **build:bundle**: JS/ワーカーなど実行時に必要なアセットを生成するタスク。型出力は想定しない。Turbo では `build:types`（同一パッケージ）完了後に実行する。

## 実装ルール

1. すべてのパッケージは `package.json` の `scripts` セクションで上記 3 種のターゲットを定義する。既存の `build` は以下のように分割する。

   ```json
   {
     "scripts": {
       "clean": "rm -rf dist",
       "build": "pnpm run clean && pnpm run stage:types && pnpm run stage:bundle",
       "build:types": "NODE_OPTIONS=\"--loader ts-node/esm\" tsup --dts-only",
       "build:bundle": "NODE_OPTIONS=\"--loader ts-node/esm\" tsup --dts=false --no-clean"
     }
   }
   ```

   - `build:types` は tsup の `--dts-only` もしくは `tsc -b` を用いて型のみに特化する。
   - `build:bundle` では `--dts=false --no-clean` を付与し、直前に生成した `.d.ts` を破棄しない。
   - 既存の `build` 呼び出し互換を保つため、`clean → build:types → build:bundle` の順で実行する。

2. Turbo パイプラインでは以下を前提とする。

   ```json
   {
     "tasks": {
       "build": { "dependsOn": ["stage:bundle", "stage:types"], "outputs": ["dist/**", "stage/**", "storybook-static/**"] },
       "build:types": { "dependsOn": ["^stage:types"], "outputs": ["dist/**"] },
       "build:bundle": { "dependsOn": ["stage:types", "^stage:bundle"], "outputs": ["dist/**", "stage/**"] }
     }
   }
   ```

   - パッケージ固有の `turbo.pipeline` でも `build:bundle` や `build:types` を参照する場合は上記命名に揃える。
   - `dependsOn` は極力既存タスク（typecheck 等）ではなく、ビルドチェインに必要なターゲットに限定する。

3. 追加タスク（例: `build:storybook` など）を導入する場合は、`build:` プレフィックス以降で意味が衝突しないよう命名し、上記 3 種の役割を置き換えないこと。

## ドキュメント/運用の扱い

- 新規パッケージを作成する際は、この命名セットをテンプレートに取り入れ、`build` 単体タスクを設置しない。
- 既存パッケージの移行時には Turbo パイプライン（ルート/パッケージ両方）と `pnpm` ルートスクリプトの依存を必ず更新する。
- ルール違反は lint（Issue 化予定）で検知する方針。暫定的に揺れが必要な場合は対象 GitHub Issue に理由と期限を記載する。
