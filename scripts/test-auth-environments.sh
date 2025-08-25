#!/bin/bash

# ================================================================
# 認証環境パターンE2Eテスト実行スクリプト
# 作成日: 2025年8月25日
# 更新日: 2025年8月25日
# ================================================================

set -e  # エラーが発生したら即座に停止

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/e2e-results/auth-flow-logs"

# 結果ディレクトリを作成
mkdir -p "$RESULTS_DIR"

echo "=================================================="
echo "認証フロー環境パターンE2Eテスト"
echo "作成日: 2025年8月25日"
echo "更新日: 2025年8月25日"
echo "=================================================="
echo ""

# クリーンアップ関数
cleanup() {
    echo "クリーンアップ中..."
    # 起動中のサーバーを停止
    pkill -f "vite" || true
    pkill -f "playwright" || true
    sleep 2
}

# エラー時とスクリプト終了時にクリーンアップ
trap cleanup EXIT

# ================================================================
# パターン1: 開発環境のテスト
# ================================================================

echo "=============================="
echo "パターン1: 開発環境"
echo "=============================="

# 環境変数を設定
export VITE_ENV_MODE="development"
source "$SCRIPT_DIR/env/development.sh"

# セキュアな環境変数を読み込み（存在する場合）
if [ -f "$PROJECT_ROOT/app/.env.secrets" ]; then
    echo "📔 .env.secretsを読み込み中..."
    set -a
    source "$PROJECT_ROOT/app/.env.secrets"
    set +a
fi

# Vite開発サーバーを起動（本番BFFを使用）
echo "Vite開発サーバーを起動中（本番BFF使用）..."
(cd "$PROJECT_ROOT/app" && pnpm dev) &
VITE_PID=$!
sleep 5

# E2Eテストを実行（開発環境のみ）
echo "E2Eテストを実行中..."
cd "$PROJECT_ROOT"
npx playwright test e2e/auth-flow.spec.ts --grep "development環境" --reporter=list

# サーバーを停止
kill $VITE_PID 2>/dev/null || true
sleep 2

# ================================================================
# パターン2: 本番環境のテスト（ビルド済み）
# ================================================================

echo ""
echo "=============================="
echo "パターン2: 本番環境（ビルド済み）"
echo "=============================="

# 環境変数を設定
export VITE_ENV_MODE="production"
source "$SCRIPT_DIR/env/production.sh"

# セキュアな環境変数を読み込み（存在する場合）
if [ -f "$PROJECT_ROOT/app/.env.secrets" ]; then
    set -a
    source "$PROJECT_ROOT/app/.env.secrets"
    set +a
fi

# ビルド実行
echo "本番用ビルドを実行中..."
cd "$PROJECT_ROOT"
pnpm build

# プレビューサーバーを起動
echo "プレビューサーバーを起動中..."
(cd "$PROJECT_ROOT/app" && npx vite preview --port 5173) &
PREVIEW_PID=$!
sleep 5

# E2Eテストを実行（本番環境のみ）
echo "E2Eテストを実行中..."
cd "$PROJECT_ROOT"
npx playwright test e2e/auth-flow.spec.ts --grep "production環境" --reporter=list

# サーバーを停止
kill $PREVIEW_PID 2>/dev/null || true

# ================================================================
# 分析レポートの生成
# ================================================================

echo ""
echo "=============================="
echo "テスト結果の分析"
echo "=============================="

# 分析テストを実行
npx playwright test e2e/auth-flow.spec.ts --grep "全環境のログを比較分析" --reporter=list

# 結果サマリーを表示
echo ""
echo "=============================="
echo "テスト完了"
echo "=============================="
echo ""
echo "結果は以下のディレクトリに保存されました:"
echo "  $RESULTS_DIR"
echo ""
echo "ファイル一覧:"
ls -la "$RESULTS_DIR" 2>/dev/null || echo "（ファイルなし）"

# 分析結果があれば表示
if [ -f "$RESULTS_DIR/analysis.json" ]; then
    echo ""
    echo "分析結果:"
    cat "$RESULTS_DIR/analysis.json"
fi