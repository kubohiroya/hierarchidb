# E2E認証テスト実行手順書

**作成日**: 2025年8月25日  
**更新日**: 2025年8月25日

## 概要

HierarchiDBの認証フローを2つの環境（開発環境・本番環境）でE2Eテストする手順書です。Playwrightを使用してヘッドレスブラウザでテストを実行し、ログとスクリーンショットを収集して分析します。

## 前提条件

### 必要なツール
- Node.js v20.0.0以上
- pnpm v9.0.0以上
- Playwright（自動インストール）

### 環境設定ファイル
```
scripts/
├── env/
│   ├── base.sh          # 共通設定
│   ├── development.sh   # 開発環境設定
│   └── production.sh    # 本番環境設定
├── start-env.sh         # 環境起動スクリプト
└── test-auth-environments.sh  # E2Eテスト実行スクリプト

app/
├── .env.secrets         # セキュアな環境変数（要作成）
└── .env.secrets.example # テンプレート
```

## セットアップ

### 1. 依存関係のインストール

```bash
# プロジェクトルートで実行
pnpm install

# Playwrightブラウザのインストール
npx playwright install
```

### 2. セキュアな環境変数の設定

```bash
# テンプレートからコピー
cp app/.env.secrets.example app/.env.secrets

# 編集して実際の値を設定
vi app/.env.secrets
```

必要な環境変数:
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `VITE_GITHUB_CLIENT_ID` - GitHub OAuth Client ID
- その他OAuth関連の設定

## テスト実行方法

### 方法1: 自動化スクリプト（推奨）

すべての環境を順番にテストする場合:

```bash
# 実行権限を付与（初回のみ）
chmod +x scripts/test-auth-environments.sh

# テスト実行
./scripts/test-auth-environments.sh
```

このスクリプトは以下を自動実行します:
1. 開発環境のテスト
2. 本番環境のビルドとテスト
3. 結果の分析レポート生成

### 方法2: 個別環境のテスト

#### 開発環境のテスト

```bash
# ターミナル1: 開発サーバー起動
pnpm dev  # または ./scripts/start-env.sh development

# ターミナル2: E2Eテスト実行
npx playwright test e2e/auth-flow.spec.ts --grep "development環境"
```

#### 本番環境のテスト

```bash
# ビルド実行
pnpm build  # または ./scripts/start-env.sh production build

# ターミナル1: プレビューサーバー起動
cd app && npx vite preview --port 5173

# ターミナル2: E2Eテスト実行
npx playwright test e2e/auth-flow.spec.ts --grep "production環境"
```

### 方法3: Playwright UIモード（デバッグ用）

```bash
# UIモードでテスト実行（ブラウザが開きます）
npx playwright test --ui

# または特定のテストファイルのみ
npx playwright test e2e/auth-flow.spec.ts --ui
```

## テスト結果の確認

### 出力ディレクトリ構成

```
e2e-results/
└── auth-flow-logs/
    ├── development-{timestamp}.json      # 開発環境のログ（JSON）
    ├── development-readable-{timestamp}.log  # 開発環境のログ（可読形式）
    ├── development-01-initial.png        # 初期画面のスクリーンショット
    ├── development-02-after-auth.png     # 認証後のスクリーンショット
    ├── production-{timestamp}.json       # 本番環境のログ（JSON）
    ├── production-readable-{timestamp}.log   # 本番環境のログ（可読形式）
    ├── production-01-initial.png         # 初期画面のスクリーンショット
    ├── production-02-after-auth.png      # 認証後のスクリーンショット
    └── analysis.json                     # 全環境の比較分析結果
```

### ログの見方

#### 可読形式ログ (.log)
```
[+123ms] REQUEST GET http://localhost:4200/
[+145ms] RESPONSE http://localhost:4200/ -> 200
[+234ms] CONSOLE (log): App initialized
[+456ms] REQUEST POST https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth/signin
[+789ms] RESPONSE https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth/signin -> 200
```

#### JSON形式ログ (.json)
```json
{
  "timestamp": "+123ms",
  "type": "request",
  "method": "GET",
  "url": "http://localhost:4200/"
}
```

### 分析レポート (analysis.json)

```json
{
  "development": {
    "totalLogs": 45,
    "consoleMessages": 12,
    "requests": 15,
    "responses": 15,
    "errors": 0,
    "authEndpoints": [
      "https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth/google/authorize",
      "https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth/token"
    ]
  },
  "production": {
    "totalLogs": 42,
    "consoleMessages": 10,
    "requests": 14,
    "responses": 14,
    "errors": 0,
    "authEndpoints": [...]
  }
}
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. ポート競合エラー

```bash
Error: Port 4200 is already in use
```

**解決方法**:
```bash
# 既存のプロセスを停止
pkill -f vite
# または
lsof -ti:4200 | xargs kill -9
```

#### 2. Playwright ブラウザが見つからない

```bash
Error: browserType.launch: Executable doesn't exist
```

**解決方法**:
```bash
# ブラウザを再インストール
npx playwright install
```

#### 3. 環境変数が読み込まれない

**解決方法**:
```bash
# 環境変数を確認
source scripts/env/development.sh
echo $VITE_BFF_BASE_URL

# .env.secretsの存在確認
ls -la app/.env.secrets
```

#### 4. 認証フローが完了しない

**原因**: E2Eテストでは実際のOAuth認証画面を自動操作できません

**対処**: 
- テストはリダイレクトURLの確認まで
- 完全な認証フローは手動テストで確認

### デバッグモード

詳細なデバッグ情報を取得:

```bash
# デバッグモードでテスト実行
DEBUG=pw:api npx playwright test e2e/auth-flow.spec.ts

# ヘッドフルモード（ブラウザを表示）
npx playwright test e2e/auth-flow.spec.ts --headed

# スローモーション（動作を遅くして観察）
npx playwright test e2e/auth-flow.spec.ts --headed --slow-mo=1000
```

## CI/CD統合

### GitHub Actions設定例

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      
      - run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: ./scripts/test-auth-environments.sh
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GITHUB_CLIENT_ID: ${{ secrets.VITE_GITHUB_CLIENT_ID }}
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-results
          path: e2e-results/
```

## ベストプラクティス

### 1. テスト実行前の確認事項
- [ ] 最新のコードを取得 (`git pull`)
- [ ] 依存関係を更新 (`pnpm install`)
- [ ] 環境変数を設定 (`.env.secrets`)
- [ ] ポートが空いている (4200, 5173)

### 2. テストの並列実行を避ける
- 同じポートを使用するため、環境ごとに順番に実行
- CI環境では`--workers=1`オプションを使用

### 3. ログの定期的なクリーンアップ
```bash
# 7日以上前のログを削除
find e2e-results -name "*.log" -mtime +7 -delete
find e2e-results -name "*.json" -mtime +7 -delete
```

### 4. セキュリティ
- `.env.secrets`をGitにコミットしない
- CI/CDではシークレット管理機能を使用
- ログにトークンや秘密情報が含まれないか確認

## 関連ドキュメント

- [認証環境パターン](./16-authentication-environments.md)
- [認証シーケンス詳細](./15-authentication-sequence.md)
- [Playwright公式ドキュメント](https://playwright.dev/)

## まとめ

このE2Eテストフレームワークにより、以下が可能になります:

1. **自動化された認証フローテスト**: 開発・本番環境での動作確認
2. **詳細なログ収集**: Console、ネットワーク、エラーの記録
3. **視覚的な確認**: スクリーンショットによる画面遷移の記録
4. **比較分析**: 環境間の挙動の違いを数値化

定期的にテストを実行し、認証フローの品質を維持してください。