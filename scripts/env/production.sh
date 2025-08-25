#!/bin/bash

# ================================================================
# 本番環境の設定（差分のみ定義）
# GitHub Pages/Vercel/Netlify + 共通BFF + 実OAuth
# ================================================================

# 基本設定を読み込み
source "$(dirname "$0")/base.sh"

# 本番環境固有の設定（上書き）
# HierarchiDB専用BFF（複数デプロイ先対応）
export VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
export VITE_USE_HASH_ROUTING="true"
export VITE_APP_NAME="hierarchidb"
export VITE_APP_TITLE="HierarchiDB"
export VITE_ENV_MODE="production"

# 本番環境での追加設定
# デプロイ先に応じて変更可能
export VITE_APP_URL="https://kubohiroya.github.io/hierarchidb"
# export VITE_APP_URL="https://hierarchidb.vercel.app"
# export VITE_APP_URL="https://hierarchidb.netlify.app"

# ビルド最適化設定
export NODE_ENV="production"
export VITE_BUILD_SOURCEMAP="false"
export VITE_DEBUG_MODE="false"

export VITE_GOOGLE_CLIENT_ID="http://116194448043-hesk0hio07cec1qdgm510kurefh0gh61.apps.googleusercontent.com"
export VITE_GITHUB_CLIENT_ID="Ov23liRWoNQEyVrTghMj"
