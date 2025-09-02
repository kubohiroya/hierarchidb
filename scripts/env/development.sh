#!/bin/bash

# ================================================================
# 開発環境の設定（差分のみ定義）
# 開発サーバー + 共通BFF + 実OAuth
# ================================================================

# 基本設定を読み込み
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/base.sh"

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

# --- Worker feature flags ---
# NOTE: The following two flags are deprecated and ignored (>= 2025-09-02):
# WORKER_USE_CMDPROC_CREATE_UPDATE, WORKER_USE_CMDPROC_MOVE_REMOVE
# They are kept here only for historical reference.
# export WORKER_TRASH_USE_HOLDER="1"            # Switch to holder-based trash handling
# export WORKER_METRICS_ENABLED="1"             # Enable lightweight dev metrics
# export WORKER_TX_ENABLED="1"                  # Enable per-command Dexie transactions
