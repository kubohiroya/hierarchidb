# 環境設定管理ガイド

## 概要

HierarchiDBプロジェクトでは、環境設定を**起動スクリプト**で一元管理しています。
`.env.*`ファイルは使用せず、各環境パターンに対応したスクリプトで環境変数を宣言的に設定します。

## 環境パターン

| パターン | スクリプト | 説明 |
|---------|-----------|------|
| **ローカル開発** | `start-local.sh` | モックBFF + モック認証 |
| **ステージング** | `start-staging.sh` | 実BFF + 実OAuth（開発サーバー） |
| **本番ビルド** | `build-production.sh` | GitHub Pages向けビルド |

## 使用方法

### 1. ローカル開発環境で開発

```bash
# モックBFFとVite開発サーバーを起動
./scripts/start-local.sh
```

- モックBFFサーバー: http://localhost:8787
- 開発サーバー: http://localhost:4200
- 外部依存なし、オフライン開発可能

### 2. 本番BFFとの統合テスト

```bash
# 本番BFFを使用してVite開発サーバーを起動
./scripts/start-staging.sh
```

- 開発サーバー: http://localhost:4200
- BFF: Cloudflare Workers（本番）
- 実際のOAuth認証フロー

### 3. 本番用ビルド

```bash
# 本番環境向けにビルド
./scripts/build-production.sh

# GitHub Pagesへデプロイ
pnpm deploy
```

## 環境設定の確認

```bash
# 全環境の設定を一覧表示
node scripts/env-config.js list

# 特定環境の設定を表示
node scripts/env-config.js show local
node scripts/env-config.js show staging
node scripts/env-config.js show production

# 環境変数をエクスポート（他のスクリプトで使用）
eval $(node scripts/env-config.js export local)
```

## 環境変数の詳細

### 共通変数

| 変数名 | 説明 |
|--------|------|
| `VITE_BFF_BASE_URL` | BFFサーバーのベースURL |
| `VITE_USE_HASH_ROUTING` | ハッシュルーティングの使用（GitHub Pages対応） |
| `VITE_APP_NAME` | アプリケーションのベースパス |
| `VITE_APP_TITLE` | アプリケーションのタイトル |

### 環境別の設定値

#### ローカル開発（local）
```bash
VITE_BFF_BASE_URL="http://localhost:8787/api/auth"
VITE_USE_HASH_ROUTING="false"
VITE_APP_NAME=""
VITE_APP_TITLE="HierarchiDB (Local)"
```

#### ステージング（staging）
```bash
VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev/api/auth"
VITE_USE_HASH_ROUTING="true"
VITE_APP_NAME="hierarchidb"
VITE_APP_TITLE="HierarchiDB (Staging)"
```

#### 本番（production）
```bash
VITE_BFF_BASE_URL="https://hierarchidb-bff-prod.kubohiroya.workers.dev/api/auth"
VITE_USE_HASH_ROUTING="true"
VITE_APP_NAME="hierarchidb"
VITE_APP_TITLE="HierarchiDB"
```

## セキュアな環境変数の管理

### `.env.secrets`ファイル

セキュアな情報（APIキー、シークレット等）は`.env.secrets`ファイルで管理します：

1. **テンプレートからコピー**
   ```bash
   cp app/.env.secrets.example app/.env.secrets
   ```

2. **実際の値を設定**
   ```bash
   # app/.env.secrets を編集
   GOOGLE_CLIENT_SECRET=your-actual-secret
   JWT_SECRET=your-actual-jwt-secret
   ```

3. **Gitで管理されないことを確認**
   ```bash
   git status  # .env.secrets が表示されないことを確認
   ```

### セキュリティベストプラクティス

- ✅ `.env.secrets`は各開発者がローカルに作成
- ✅ 本番環境ではCloudflare Workersのシークレット管理を使用
- ✅ CI/CDではGitHub Secretsなどを使用
- ❌ セキュアな値をスクリプトにハードコードしない
- ❌ `.env.secrets`をGitにコミットしない

## 移行ガイド

### 従来の`.env.*`ファイルからの移行

1. **セキュアな値を`.env.secrets`に移動**
   ```bash
   # 既存の.envファイルからセキュアな値を抽出
   grep -E "SECRET|PASSWORD|KEY" app/.env.* > app/.env.secrets
   
   # 編集して整形
   vi app/.env.secrets
   ```

2. **既存の`.env.*`ファイルを削除**
   ```bash
   # バックアップ（念のため）
   mkdir -p .env-backup
   mv app/.env.development app/.env.production .env-backup/
   
   # 削除
   rm app/.env.*
   ```

2. **package.jsonのスクリプトを更新**
   ```json
   {
     "scripts": {
       "dev": "./scripts/start-staging.sh",
       "dev:local": "./scripts/start-local.sh",
       "dev:staging": "./scripts/start-staging.sh",
       "build": "./scripts/build-production.sh",
       "build:analyze": "ANALYZE=true ./scripts/build-production.sh"
     }
   }
   ```

3. **.gitignoreを更新**
   ```gitignore
   # 環境変数ファイル（使用しない）
   .env
   .env.*
   !.env.example  # テンプレートは残す場合
   
   # スクリプトのログ
   scripts/*.log
   ```

## カスタマイズ

### 新しい環境を追加する場合

1. `scripts/env-config.js`に環境定義を追加
2. 対応する起動スクリプトを作成
3. このREADMEを更新

### 環境変数を追加する場合

1. `scripts/env-config.js`の該当環境に変数を追加
2. 各起動スクリプトに`export`文を追加
3. 必要に応じてアプリケーションコードを更新

## トラブルシューティング

### スクリプトが実行できない

```bash
# 実行権限を付与
chmod +x scripts/*.sh
```

### 環境変数が反映されない

```bash
# 環境変数を確認
node scripts/env-config.js show [環境名]

# プロセスを完全に停止してから再起動
pkill -f "vite"
pkill -f "node.*mock"
```

### ポート競合

```bash
# 使用中のポートを確認
lsof -i :4200
lsof -i :8787

# 必要に応じてポートを変更（スクリプト内で修正）
```

## メリット

✅ **宣言的**: 各環境の設定が明確
✅ **再現性**: チーム全体で同じ環境を構築
✅ **切り替え簡単**: スクリプト実行で即座に切り替え
✅ **エラー防止**: 環境変数の設定ミスを防ぐ
✅ **ドキュメント不要**: スクリプト自体がドキュメント

## 注意事項

⚠️ **セキュリティ**: 本番用の秘密情報はスクリプトに含めない
⚠️ **バージョン管理**: スクリプトはGitで管理するが、機密情報は含めない
⚠️ **CI/CD**: CI/CD環境では別途環境変数を設定する必要がある