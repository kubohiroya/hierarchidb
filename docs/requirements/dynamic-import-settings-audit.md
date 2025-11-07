# Dynamic Import Settings Audit

このメモでは、動的 import 統一に伴い調整が必要となる CI / スクリプト / ツール設定を洗い出し、現時点で把握した影響点を記録する。

## .github/workflows
- `unit-ci.yml`
  - 複数ジョブで `pnpm --filter @hierarchidb/*-plugin` を直接指定している。プラグイン再構成後も動作させるため、プラグイン名→ワーカー/ファクトリ名の対応リストをメンテする仕組みが必要。
  - 旧 `migrate-plugin-worker` codemod（現在は撤去済み）を利用していたため、後継 codemod を再導入する際は `pnpm codemod:run --codemod <name> --dry-run --plugin <target>` 相当のチェックを CI に追加し、静的再エクスポートが残っていないことを自動検証する案を再検討する。
- `dts-check.yml`
  - `@hierarchidb/shape-plugin` のみ直接指定されている。プラグインを段階的に factory 化する際に対象を追加する必要がある。

## Scripts
- `package.json` の `dev:*` / `build:*` / `preview:*` スクリプト、`scripts/generate-plugin-loader.mjs`
  - 2025-11-10 時点で run-env-vite.sh を廃止し、Bash ワンライナーで環境設定を読み込む方式へ移行済み。動的 import レジストリは Vite プラグイン内で自動生成されるため、旧 `tools:gen-plugin-registry` 呼び出しは不要になった。
- `scripts/check-shims.mjs`
  - dist 参照など、factory 化後にパスが変わる箇所を検出する必要有り。
  - 要調査: Worker factory への移行後に shim が再生成されるかどうか。
- `scripts/codemods/runner.ts`
  - 新しい codemod ランナー導入済み。今後 CI での dry-run を組み込みやすいように option を整備。

## その他設定
- `knip.json`
  - `scripts/codemods/**/*` は既に対象に含まれているが、プラグイン factory モジュールを追加した際の追跡が必要。
- `tsup.*`, `vitest.config.ts`
  - factory 導入後にエントリポイントが変わる場合、bundle/テスト設定のエントリ補正が必要。

この一覧は作業と並行して更新し、完了した項目にはチェックを付けていく。
