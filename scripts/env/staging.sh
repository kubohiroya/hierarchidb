#!/bin/bash

# ================================================================
# 開発環境の設定（差分のみ定義）
# 開発サーバー + 本番BFF + 実OAuth
# ================================================================

# 基本設定を読み込み
source "$(dirname "$0")/base.sh"

# 開発環境固有の設定（上書き）
export VITE_BFF_BASE_URL="https://eria-cartograph-bff.kubohiroya.workers.dev/api/auth"
export VITE_USE_HASH_ROUTING="true"
export VITE_APP_NAME="hierarchidb"
export VITE_APP_TITLE="HierarchiDB (Development)"
export VITE_ENV_MODE="development"