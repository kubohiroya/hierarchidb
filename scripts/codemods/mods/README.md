# Codemod Modules

このディレクトリには個別の codemod 実装を配置します。ファイルは以下の条件を満たしてください。

- `export async function runCodemod(options)` を公開する。
- 必要に応じて `export function describe()` で概要を返す。
- 変換対象の収集や dry-run 対応は runner から渡される `options` を利用する。
