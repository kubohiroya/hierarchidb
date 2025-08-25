#!/bin/bash

# ================================================================
# パターン2: 本番環境デバッグ（ステージング）
# Vite開発サーバー + 本番Cloudflare BFF + 実OAuth
# ================================================================

echo "🔍 Starting Staging Environment (Pattern 2)"
echo "============================================"
echo "✓ Vite Dev Server at localhost:4200"
echo "✓ Production BFF at Cloudflare Workers"
echo "✓ Real OAuth providers (Google/GitHub)"
echo ""

# セキュアな環境変数を読み込み（必須）
if [ -f "app/.env.secrets" ]; then
  echo "📔 Loading secrets from .env.secrets"
  set -a
  source app/.env.secrets
  set +a
else
  echo "⚠️  Warning: .env.secrets file not found"
  echo "   Some features may not work without API secrets"
fi

# 公開可能な環境変数を設定
export VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev/api/auth"
export VITE_USE_HASH_ROUTING="true"
export VITE_APP_NAME="hierarchidb"
export VITE_APP_TITLE="HierarchiDB (Staging)"
export VITE_ENV_MODE="staging"

# 警告表示
echo "⚠️  Note: This uses the production BFF server"
echo "⚠️  Make sure CORS is configured for localhost:4200"
echo ""

# Viteサーバーを起動
echo "Starting Vite Dev Server with production BFF..."
cd app && pnpm dev