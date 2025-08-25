#!/bin/bash

# ================================================================
# ローカル開発環境の設定（差分のみ定義）
# パターン1: モックBFF + モック認証
# ================================================================

# 基本設定を読み込み
source "$(dirname "$0")/base.sh"

# ローカル環境固有の設定（上書き）
export VITE_BFF_BASE_URL="http://localhost:8787/api/auth"
export VITE_USE_HASH_ROUTING="false"
export VITE_APP_NAME=""
export VITE_APP_TITLE="HierarchiDB (Local)"
export VITE_ENV_MODE="local"

# モックBFFサーバーの設定
export MOCK_BFF_PORT="8787"
export MOCK_BFF_ENABLED="true"