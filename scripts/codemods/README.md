# Codemod 実行ガイド

本ディレクトリには ts-morph を利用したコード変換スクリプトを配置します。共通ラッパーを介して対象ファイルの収集から整形まで自動化し、小さな差分で安全に導入することを意図しています。

## 実行フロー
1. 対象プラグインやパッケージを指定して codemod を実行します。
2. 変換後に Prettier / ESLint (--fix) を実行してフォーマットと規約を統一します。
3. 影響パッケージで `pnpm --filter <pkg> typecheck` を実行し、型検証を必ず記録します。

## サンプルコマンド
```bash
pnpm codemod:run --codemod migrate-plugin-worker --plugin resolver
pnpm lint --fix
pnpm --filter @hierarchidb/plugin-loader-resolver-plugin typecheck
```

## コーディング規約
- ts-morph API を利用し、文字列置換ではなく AST ベースで変換してください。
- 変換ロジックには dry-run オプションを用意し、差分確認を前提とします。
- 変換の前後で `tsconfig.esm-nodenext.json` 等の共通設定が適用されることを想定し、ESM import/export を崩さないように注意してください。

## ファイル構成
- `runner.ts`: 共通 CLI。対象ファイル収集やフォーマッタ呼び出しを司ります。
- `codemods/xxxx.ts`: 個別の変換ロジック。`runCodemod()` を export し、runner から呼び出される形に統一します。

## 注意事項
- Codemod の追加・更新時は `docs/requirements/dynamic-import-unification.md` と `TASKS.md` に進捗を記録してください。
- CI で dry-run を実行できるよう、将来的には `pnpm codemod:run --check` を追加する計画です。
