#!/bin/bash
set -euo pipefail

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
echo "  Plugin Flags:"
echo "    LOCATION_PER_HOST_CONCURRENCY=${LOCATION_PER_HOST_CONCURRENCY:-4}"
echo "    ROUTE_PER_HOST_CONCURRENCY=${ROUTE_PER_HOST_CONCURRENCY:-4}"
echo "    LOCATION_RUNTIME_WORKER=${LOCATION_RUNTIME_WORKER:-false}"
echo "    ROUTE_RUNTIME_WORKER=${ROUTE_RUNTIME_WORKER:-false}"
echo ""

# ================================================================
# 事前依存チェック（dev 起動前）
# ================================================================

if [ "$COMMAND" = "dev" ]; then
  echo "🔎 Running dependency guards (pre-dev) ..."
  # 追加ガード（速い）: workspace: プロトコル/未解決依存/lockfile差分 など
  pnpm -w run check:deps:extra || {
    echo "❌ Dependency guard failed. Please fix the above issues.";
    exit 1;
  }
  # dep-fence 本体（必要なら環境変数で有効化）
  if [ "${HDB_DEV_RUN_STRICT_DEPFENCE:-0}" = "1" ]; then
    pnpm -w run check:deps || {
      echo "❌ dep-fence check failed in strict mode.";
      exit 1;
    }
  fi
  echo "✅ Dependency guards passed"
fi

# 開発サーバ起動前に、必要なローカル Vite ツールのビルドを最低限チェック
# app の vite.config.ts が参照する @hierarchidb/vite-plugin-node-type-registry（alias プラグイン）は
# dist 出力が無いと Vite の externalize-deps 解決が失敗するため、未ビルドならビルドする
if [ ! -f "packages/tools/vite-plugin-node-type-registry/dist/index.js" ]; then
    echo "🔨 Building @hierarchidb/vite-plugin-node-type-registry (first-time or clean checkout) ..."
    pnpm --filter @hierarchidb/vite-plugin-node-type-registry build || {
        echo "❌ Failed to build @hierarchidb/vite-plugin-node-type-registry"
        echo "   Try running: pnpm --filter @hierarchidb/vite-plugin-node-type-registry build"
        exit 1
    }
    echo "✅ vite-plugin-node-type-registry built"
    echo ""
fi

# Ensure UI and worker local packages are built once if missing
ensure_built() {
  local pkg="$1"; shift
  local path_js="$1"; shift
  if [ ! -f "$path_js" ]; then
    echo "🔨 Building $pkg ..."
    pnpm --filter "$pkg" build || {
      echo "❌ Failed to build $pkg"
      echo "   Try running: pnpm --filter $pkg build"
      exit 1
    }
    echo "✅ $pkg built"
  fi
}

ensure_built "@hierarchidb/ui-core" "packages/ui/core/dist/index.js"
ensure_built "@hierarchidb/ui-theme" "packages/ui/theme/dist/index.js"
ensure_built "@hierarchidb/ui-i18n" "packages/ui/i18n/dist/index.js"
ensure_built "@hierarchidb/ui-auth" "packages/ui/auth/dist/index.js"
ensure_built "@hierarchidb/common-auth" "packages/common/auth/dist/index.js"
ensure_built "@hierarchidb/ui-date" "packages/ui/date/dist/index.js"
ensure_built "@hierarchidb/ui-usermenu" "packages/ui/usermenu/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-base" "packages/ui/treeconsole/base/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-breadcrumb" "packages/ui/treeconsole/breadcrumb/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-toolbar" "packages/ui/treeconsole/toolbar/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-treetable" "packages/ui/treeconsole/treetable/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-trashbin" "packages/ui/treeconsole/trashbin/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-footer" "packages/ui/treeconsole/footer/dist/index.js"
ensure_built "@hierarchidb/ui-treeconsole-speeddial" "packages/ui/treeconsole/speeddial/dist/index.js"
ensure_built "@hierarchidb/runtime-worker" "packages/runtime/worker/dist/index.js"
ensure_built "@hierarchidb/runtime-client" "packages/runtime/worker-bootstrap/dist/index.js"
# Core util library used across many packages
ensure_built "@hierarchidb/util" "packages/util/dist/index.js"
# Feature registry (referenced by worker dist)
ensure_built "@hierarchidb/feature-registry" "packages/feature/feature-registry/dist/index.js"
# Additional shared/runtime UI packages used by app
ensure_built "@hierarchidb/common-types" "packages/common/types/dist/index.js"
ensure_built "@hierarchidb/common-api" "packages/common/api/dist/index.js"
ensure_built "@hierarchidb/ui-import-export" "packages/ui/import-export/dist/index.js"
ensure_built "@hierarchidb/ui-layout" "packages/ui/layout/dist/index.js"
ensure_built "@hierarchidb/ui-map" "packages/ui/map/dist/index.js"
ensure_built "@hierarchidb/ui-navigation" "packages/ui/navigation/dist/index.js"
ensure_built "@hierarchidb/ui-routing" "packages/ui/routing/dist/index.js"
ensure_built "@hierarchidb/runtime-ui-landingpage" "packages/runtime-ui/landingpage/dist/index.js"
ensure_built "@hierarchidb/runtime-ui-plugin-dialog" "packages/runtime-ui/plugin-dialog/dist/index.js"
ensure_built "@hierarchidb/runtime-ui-tour" "packages/runtime-ui/tour/dist/index.js"
ensure_built "@hierarchidb/basemap-plugin" "packages/plugins/basemap-plugin/dist/index.js"
ensure_built "@hierarchidb/folder-plugin" "packages/plugins/folder-plugin/dist/index.js"
ensure_built "@hierarchidb/shape-plugin" "packages/plugins/shape-plugin/dist/index.js"
ensure_built "@hierarchidb/styler-plugin" "packages/plugins/styler-plugin/dist/index.js"
ensure_built "@hierarchidb/route-plugin" "packages/plugins/route-plugin/dist/index.js"
ensure_built "@hierarchidb/location-plugin" "packages/plugins/location-plugin/dist/index.js"
ensure_built "@hierarchidb/linker-plugin" "packages/plugins/linker-plugin/dist/index.js"

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
