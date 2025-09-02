#!/bin/bash

# ================================================================
# 統一起動スクリプト
# 環境名を引数で指定して起動
# ================================================================

# 使用方法を表示
show_usage() {
    echo "Usage: $0 <environment> [command]"
    echo ""
    echo "Environments:"
    echo "  development - Development with production BFF"
    echo "  production  - Production build"
    echo ""
    echo "Commands:"
    echo "  dev        - Start development server (default)"
    echo "  build      - Build for production"
    echo "  test       - Run tests"
    echo ""
    echo "Examples:"
    echo "  $0 development        # Start development server"
    echo "  $0 production build   # Build for production"
    echo ""
}

# 引数チェック
if [ $# -lt 1 ]; then
    show_usage
    exit 1
fi

ENV_NAME=$1
COMMAND=${2:-dev}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 環境設定ファイルの存在確認
ENV_FILE="$SCRIPT_DIR/env/$ENV_NAME.sh"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: Environment '$ENV_NAME' not found"
    echo "   Expected file: $ENV_FILE"
    echo ""
    show_usage
    exit 1
fi

# ================================================================
# 環境設定を読み込み
# ================================================================

echo "🔧 Loading environment: $ENV_NAME"
echo "=================================================="

# 環境設定を読み込み（base.sh も自動的に読み込まれる）
source "$ENV_FILE"

# セキュアな環境変数を読み込み（存在する場合）
if [ -f "app/.env.secrets" ]; then
    echo "🔐 Loading secrets from .env.secrets"
    set -a
    source app/.env.secrets
    set +a
else
    echo "⚠️  Warning: No .env.secrets file found"
    echo "   Some features may not work properly"
fi

# 環境情報を表示
echo ""
echo "📋 Environment Configuration:"
echo "  Mode: $VITE_ENV_MODE"
echo "  Title: $VITE_APP_TITLE"
echo "  BFF URL: $VITE_BFF_BASE_URL"
echo "  Hash Routing: $VITE_USE_HASH_ROUTING"
echo "  Worker Flags:"
echo "    WORKER_USE_CMDPROC_CREATE_UPDATE=${WORKER_USE_CMDPROC_CREATE_UPDATE:-0}"
echo "    WORKER_USE_CMDPROC_MOVE_REMOVE=${WORKER_USE_CMDPROC_MOVE_REMOVE:-0}"
echo "    WORKER_TRASH_USE_HOLDER=${WORKER_TRASH_USE_HOLDER:-0}"
echo "    WORKER_METRICS_ENABLED=${WORKER_METRICS_ENABLED:-0}"
echo "    WORKER_TX_ENABLED=${WORKER_TX_ENABLED:-0}"
echo ""

# ================================================================
# コマンド実行
# ================================================================

case "$COMMAND" in
    dev)
        echo "🚀 Starting development server..."
        cd app && pnpm dev
        ;;
        
    build)
        echo "📦 Building for $ENV_NAME..."
        pnpm build:turbo
        echo ""
        echo "✅ Build complete!"
        
        if [ "$ENV_NAME" = "production" ]; then
            echo ""
            echo "Next steps:"
            echo "1. Review the build output in packages/app/dist"
            echo "2. Deploy to GitHub Pages: pnpm deploy"
        fi
        ;;
        
    test)
        echo "🧪 Running tests in $ENV_NAME environment..."
        pnpm test
        ;;
        
    *)
        echo "❌ Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
