#!/bin/bash

# ================================================================
# パターン1: ローカル開発環境
# モックBFFサーバー + モック認証を使用した完全ローカル環境
# ================================================================

echo "🚀 Starting Local Development Environment (Pattern 1)"
echo "=================================================="
echo "✓ Mock BFF Server at localhost:8787"
echo "✓ Vite Dev Server at localhost:4200"
echo "✓ No external dependencies required"
echo ""

# セキュアな環境変数を読み込み（存在する場合）
if [ -f "app/.env.secrets" ]; then
  echo "📔 Loading secrets from .env.secrets"
  set -a
  source app/.env.secrets
  set +a
else
  echo "ℹ️  No .env.secrets file found (OK for local mock environment)"
fi

# 公開可能な環境変数を設定
export VITE_BFF_BASE_URL="http://localhost:8787/api/auth"
export VITE_USE_HASH_ROUTING="false"
export VITE_APP_NAME=""
export VITE_APP_TITLE="HierarchiDB (Local)"
export VITE_ENV_MODE="local"

# モックBFFサーバーを起動（バックグラウンド）
echo "Starting Mock BFF Server..."
(cd packages/backend/bff && PORT=8787 node mock-signin-endpoint.js) &
MOCK_PID=$!

# 少し待ってからViteサーバーを起動
sleep 2

echo "Starting Vite Dev Server..."
cd app && pnpm dev

# 終了時にモックサーバーも停止
trap "kill $MOCK_PID 2>/dev/null" EXIT