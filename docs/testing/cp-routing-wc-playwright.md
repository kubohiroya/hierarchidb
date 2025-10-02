# CP Routing + Working Copy Playwright スモーク手順

cp-routing フローの UI E2E テスト（`e2e/cp-routing-wc-flow.spec.ts`）をローカルで再現するための手順です。Chromium プロジェクトを対象にした最小スモークを想定しています。

## 事前準備

- 依存関係をインストール: `pnpm install`
- Playwright ブラウザを展開（初回のみ）: `pnpm exec playwright install --with-deps chromium`
- メモ: Playwright のブラウザキャッシュを共有している場合は `PLAYWRIGHT_BROWSERS_PATH=0` を設定しても問題ありません。

## 実行方法

1. ルートディレクトリで次のコマンドを実行します。

   ```bash
   pnpm exec playwright test e2e/cp-routing-wc-flow.spec.ts --project=chromium
   ```

   - `playwright.config.ts` の設定により、テスト実行時に `@hierarchidb/app` のビルドと `preview` サーバー起動が自動的に行われます（初回は数分かかることがあります）。
   - 既に `pnpm --filter @hierarchidb/app preview` などでプレビューサーバーを起動済みの場合は、別ターミナルでプレビューを維持したまま `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test ...` とするとビルドを省略できます。
   - 進捗を細かく確認したいときは `DEBUG=pw:webserver` を付けて実行すると、Playwright が webServer のライフサイクルをログ出力します。
   - 長時間静止しているように見える場合は、ビルド状況の進行ログが `scripts/prebuild-app.mjs` から数十秒ごとに出力されます。追加の可視化が必要であれば `PLAYWRIGHT_SKIP_WEBSERVER=1` + 既存サーバー流用を検討してください。

2. デバッグ目的でブラウザを表示したい場合は `--headed` オプションを付与してください。

   ```bash
   pnpm exec playwright test e2e/cp-routing-wc-flow.spec.ts --project=chromium --headed
   ```

## DOM 安定化とフラグ初期化について

- テストは `e2e/utils/test-helpers.ts` の `waitForTreeTableLoad` / `waitForSubTreeUpdate` / `waitForWorkingCopyUpdate` を利用しており、TreeTable の描画や Working Copy 同期が完了するまで待機します。必要に応じて `waitForSubTreeUpdate(page, timeout)` のタイムアウト値をシナリオ側で拡張できます。
- Worker フラグの override は `resetWorkerFlagOverrides` で初期化され、`configureWorkerCmdprocOverride` を通じてローカルストレージと Node.js 側の環境変数へ揃えて適用されます。cp-routing フローの spec には `beforeEach` での初期化が組み込まれているため追加の作業は不要です。

## よくあるトラブル

- **ブラウザが見つからないエラー**: Playwright ブラウザを再インストールしてください（`pnpm exec playwright install --with-deps chromium`）。
- **ポート競合**: 既に `http://localhost:4173` が使用されている場合は手動で停止するか、`PLAYWRIGHT_SKIP_WEBSERVER=1` を指定して既存サーバーを流用してください。
- **データ汚染**: TreeTable の状態が想定と異なる場合は `resetWorkerFlagOverrides(page)` が呼ばれていることを確認し、必要に応じてテスト冒頭で `clearTestData(page)` を追加してください。
- **進行状況が見えない**: `DEBUG=pw:webserver` を付けて実行すると Playwright の webServer 管理ログが表示されます。さらに `pnpm --filter @hierarchidb/app preview` を別ターミナルで起動し、本コマンドでは `PLAYWRIGHT_SKIP_WEBSERVER=1` を指定すると無音時間を避けられます。

## 参考

- `e2e/cp-routing-wc-flow.spec.ts`
- `e2e/utils/test-helpers.ts`
- `app/src/config/worker-flag-overrides.ts`
