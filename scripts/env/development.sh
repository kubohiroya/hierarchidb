#!/bin/bash

# ================================================================
# 開発環境の設定（差分のみ定義）
# 開発サーバー + 共通BFF + 実OAuth
# ================================================================

# 基本設定を読み込み
source "$(dirname "$0")/base.sh"

# 開発環境固有の設定（上書き）
# HierarchiDB専用BFF（複数デプロイ先対応）
export VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
export VITE_USE_HASH_ROUTING="true"
export VITE_APP_NAME="hierarchidb"
export VITE_APP_TITLE="HierarchiDB (Development)"
export VITE_ENV_MODE="development"

# 開発環境での追加設定
export VITE_APP_URL="http://localhost:4200"
export VITE_DEBUG_MODE="true"

export VITE_GOOGLE_CLIENT_ID="http://116194448043-hesk0hio07cec1qdgm510kurefh0gh61.apps.googleusercontent.com"
export VITE_GITHUB_CLIENT_ID="Ov23liRWoNQEyVrTghMj"
