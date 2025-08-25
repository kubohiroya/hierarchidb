# 環境設定アーキテクチャ

## 設計原則

### Single Source of Truth + 差分管理

```
base.sh (共通設定)
    ↓
local.sh / staging.sh / production.sh (差分のみ)
    ↓
.env.secrets (セキュアな値、オプション)
    ↓
start-env.sh (統一実行)
```

## ファイル構成

```
scripts/
├── env/                    # 環境設定ディレクトリ
│   ├── base.sh            # 共通設定（Single Source of Truth）
│   ├── local.sh           # ローカル環境の差分
│   ├── staging.sh         # ステージング環境の差分
│   └── production.sh      # 本番環境の差分
├── start-env.sh           # 統一起動スクリプト
└── env/README.md          # このファイル

app/
├── .env.secrets           # セキュアな値（Gitignore対象）
└── .env.secrets.example   # テンプレート
```

## 動作の流れ

1. **コマンド実行**
   ```bash
   pnpm dev:local  # = ./scripts/start-env.sh local
   ```

2. **設定の読み込み順序**
   ```bash
   1. base.sh       # 共通のデフォルト値
   2. local.sh      # 環境固有の上書き
   3. .env.secrets  # セキュアな値（あれば）
   ```

3. **変数の優先順位**
   - `.env.secrets` > 環境別設定 > base.sh > デフォルト値

## 設定の追加・変更方法

### 新しい共通設定を追加

`scripts/env/base.sh` に追加：
```bash
# 新機能の設定
export VITE_NEW_FEATURE_ENABLED="${VITE_NEW_FEATURE_ENABLED:-false}"
```

### 特定環境でのみ値を変更

`scripts/env/staging.sh` に追加：
```bash
# ステージングでは新機能を有効化
export VITE_NEW_FEATURE_ENABLED="true"
```

### セキュアな値を追加

`app/.env.secrets` に追加：
```bash
# APIキー等
NEW_API_SECRET=actual-secret-value
```

## 利点

✅ **Single Source of Truth**: 共通設定は `base.sh` に集約
✅ **DRY原則**: 重複を排除、差分のみ管理
✅ **理解しやすい**: 純粋なBashスクリプト、魔法なし
✅ **デバッグ容易**: `source` コマンドの連鎖が明確
✅ **拡張性**: 新環境の追加が簡単（新しい差分ファイルを作成）

## デバッグ方法

### 設定値の確認

```bash
# 環境設定を読み込んで確認
source scripts/env/local.sh
env | grep VITE_

# または起動時に表示される設定を確認
./scripts/start-env.sh local
```

### トラブルシューティング

```bash
# bashのデバッグモードで実行
bash -x ./scripts/start-env.sh local

# 特定の変数を追跡
echo "BFF URL: $VITE_BFF_BASE_URL"
```

## 新しい環境の追加

1. **環境設定ファイルを作成**
   ```bash
   cp scripts/env/staging.sh scripts/env/qa.sh
   vi scripts/env/qa.sh  # 必要な差分を編集
   ```

2. **package.jsonにスクリプトを追加**
   ```json
   "dev:qa": "./scripts/start-env.sh qa"
   ```

3. **実行**
   ```bash
   pnpm dev:qa
   ```

## 移行ガイド（古いスクリプトから）

### Before（個別スクリプト）
```bash
# scripts/start-local.sh
export VITE_BFF_BASE_URL="http://localhost:8787/api/auth"
export VITE_USE_HASH_ROUTING="false"
export VITE_APP_NAME=""
# ... 重複する設定 ...
```

### After（差分管理）
```bash
# scripts/env/base.sh
export VITE_APP_PREFIX="hierarchidb"  # 共通

# scripts/env/local.sh
source "$(dirname "$0")/base.sh"
export VITE_BFF_BASE_URL="http://localhost:8787/api/auth"  # 差分のみ
```

## CI/CD環境での使用

```yaml
# GitHub Actions例
- name: Build Production
  run: |
    # CI環境用のシークレットを設定
    echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> app/.env.secrets
    echo "GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}" >> app/.env.secrets
    
    # ビルド実行
    ./scripts/start-env.sh production build
```

## セキュリティ注意事項

⚠️ **重要**:
- `base.sh`, `local.sh` 等: 公開可能な値のみ（Gitで管理）
- `.env.secrets`: セキュアな値のみ（Gitignore対象）
- 本番シークレット: CI/CD環境変数で管理