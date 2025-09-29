# Dynamic Import Settings Audit

このメモでは、動的 import 統一に伴い調整が必要となる CI / スクリプト / ツール設定を洗い出し、現時点で把握した影響点を記録する。

## .github/workflows
- `unit-ci.yml`
  - 複数ジョブで `pnpm --filter @hierarchidb/plugins-*-plugin` を直接指定している。プラグイン再構成後も動作させるため、プラグイン名→ワーカー/ファクトリ名の対応リストをメンテする仕組みが必要。
  - Codemod 実装後は `pnpm codemod:run --codemod migrate-plugin-worker --dry-run --plugin <name>` のようなチェックを CI に追加し、静的再エクスポートが残っていないことを自動検証する案を検討する。
- `dts-check.yml`
  - `@hierarchidb/plugins-shape-plugin` のみ直接指定されている。プラグインを段階的に factory 化する際に対象を追加する必要がある。

## Scripts
- `scripts/start-env.sh`, `scripts/generate-plugin-loader.mjs`
  - プラグインの手動列挙があるため、動的 import 版のレジストリへ置き換える必要があるか調査中。
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
