#!/bin/bash

# ================================================================
# パターン3: 本番環境ビルド
# GitHub Pages + Cloudflare BFF + 実OAuth
# ================================================================

echo "🚀 Building for Production (Pattern 3)"
echo "======================================="
echo "✓ Target: GitHub Pages"
echo "✓ Production BFF at Cloudflare Workers"
echo "✓ Real OAuth providers (Google/GitHub)"
echo ""

# セキュアな環境変数を読み込み（推奨）
if [ -f "app/.env.secrets" ]; then
  echo "📔 Loading secrets from .env.secrets"
  set -a
  source app/.env.secrets
  set +a
else
  echo "ℹ️  No .env.secrets file found"
  echo "   Build will use only public configuration"
fi

# 公開可能な環境変数を設定
export VITE_BFF_BASE_URL="https://hierarchidb-bff-prod.kubohiroya.workers.dev/api/auth"
export VITE_USE_HASH_ROUTING="true"
export VITE_APP_NAME="hierarchidb"
export VITE_APP_TITLE="HierarchiDB"
export VITE_ENV_MODE="production"

# ビルド実行
echo "Building production bundle..."
pnpm build

echo ""
echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Review the build output in packages/app/dist"
echo "2. Deploy to GitHub Pages: pnpm deploy"
echo ""