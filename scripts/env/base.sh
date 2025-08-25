#!/bin/bash

# ================================================================
# 基本環境設定（全環境共通）
# Single Source of Truth for common configuration
# ================================================================

# アプリケーション基本情報
export VITE_APP_PREFIX="hierarchidb"
export VITE_APP_DESCRIPTION="High-performance tree-structured data management framework"
export VITE_APP_LOGO="logo.png"
export VITE_APP_FAVICON="favicon.svg"
export VITE_APP_LOCALE="en-US"
export VITE_APP_ATTRIBUTION="Hiroya Kubo"

# 開発サーバー設定
export PORT="4200"
export HOST="localhost"

# Turnstile設定（開発用テストキー）
export VITE_TURNSTILE_SITE_KEY="1x00000000000000000000AA"

# OAuth Client IDs（公開可能）
export VITE_GOOGLE_CLIENT_ID="545663423405-db512fcis7kesi7rk5o307gqt99ug88i.apps.googleusercontent.com"
export VITE_GITHUB_CLIENT_ID="354fd9072f37d7ebe63d"

# ================================================================
# 環境別のデフォルト値（各環境スクリプトで上書き可能）
# ================================================================

# BFF設定のデフォルト
export VITE_BFF_BASE_URL="${VITE_BFF_BASE_URL:-http://localhost:8787/api/auth}"

# ルーティング設定のデフォルト
export VITE_USE_HASH_ROUTING="${VITE_USE_HASH_ROUTING:-false}"

# アプリケーション設定のデフォルト
export VITE_APP_NAME="${VITE_APP_NAME:-}"
export VITE_APP_TITLE="${VITE_APP_TITLE:-HierarchiDB}"

# 環境モードのデフォルト
export VITE_ENV_MODE="${VITE_ENV_MODE:-development}"