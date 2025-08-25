#!/bin/bash

# ================================================================
# HierarchiDB BFF デプロイスクリプト
# 1つのBFFで複数デプロイ先をサポート
# ================================================================

set -e  # エラーが発生したら停止

echo "=================================================="
echo "HierarchiDB BFF Deployment Script"
echo "Multiple Deploy Targets Support"
echo "=================================================="
echo ""

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定ファイルのチェック
CONFIG_FILE="wrangler.hierarchidb.toml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: $CONFIG_FILE not found${NC}"
    echo "Please ensure you're in the packages/backend/bff directory"
    exit 1
fi

# 1. 環境選択
echo "Select deployment environment:"
echo "1) Development (localhost only)"
echo "2) Production (all deploy targets)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        ENV="development"
        ENV_NAME="hierarchidb-bff-dev"
        echo -e "${GREEN}Deploying to development environment...${NC}"
        ;;
    2)
        ENV="production"
        ENV_NAME="hierarchidb-bff"
        echo -e "${GREEN}Deploying to production environment...${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

# 2. OAuth設定の確認
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Pre-deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. OAuth Apps Configuration:"
echo "   ✓ Google Cloud Console"
echo "     - Create new OAuth 2.0 Client ID for HierarchiDB"
echo "     - Add authorized redirect URIs:"
echo "       • https://hierarchidb-bff.kubohiroya.workers.dev/auth/callback"
echo "       • https://hierarchidb-bff.kubohiroya.workers.dev/auth/google/callback"
echo ""
echo "   ✓ GitHub Developer Settings"
echo "     - Create new OAuth App for HierarchiDB"
echo "     - Set authorization callback URL:"
echo "       • https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/callback"
echo ""
echo "2. Update Client IDs in $CONFIG_FILE:"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GITHUB_CLIENT_ID"
echo ""
echo "3. Supported deploy targets:"
if [ "$ENV" = "production" ]; then
    echo -e "   ${GREEN}✓ https://kubohiroya.github.io${NC}"
    echo -e "   ${GREEN}✓ https://hierarchidb.vercel.app${NC}"
    echo -e "   ${GREEN}✓ https://hierarchidb.netlify.app${NC}"
else
    echo -e "   ${GREEN}✓ http://localhost:4200${NC}"
    echo -e "   ${GREEN}✓ http://localhost:5173${NC}"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Have you completed all checklist items? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo -e "${YELLOW}Please complete the checklist first.${NC}"
    echo "Exiting without deployment."
    exit 1
fi

# 3. KV Namespaces のセットアップ（オプション）
echo ""
echo "Setting up KV Namespaces (optional)..."
echo "These are used for rate limiting and audit logging."
echo ""
read -p "Do you want to create KV namespaces? (y/n): " create_kv

if [ "$create_kv" = "y" ]; then
    echo "Creating KV namespaces..."
    
    # Rate Limit KV
    echo "Creating RATE_LIMIT namespace..."
    wrangler kv:namespace create "RATE_LIMIT" --config "$CONFIG_FILE" --env "$ENV" || true
    
    # Audit Log KV
    echo "Creating AUDIT_LOG namespace..."
    wrangler kv:namespace create "AUDIT_LOG" --config "$CONFIG_FILE" --env "$ENV" || true
    
    # Session KV
    echo "Creating SESSION namespace..."
    wrangler kv:namespace create "SESSION" --config "$CONFIG_FILE" --env "$ENV" || true
    
    echo ""
    echo -e "${YELLOW}Note: Add the KV namespace IDs to your $CONFIG_FILE${NC}"
    echo "The IDs are shown above in the format: id = \"xxxxx\""
    echo ""
    read -p "Press Enter to continue after updating the config file..."
fi

# 4. シークレットの設定
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Setting up Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You will be prompted to enter each secret value."
echo "These values are stored securely in Cloudflare and never exposed in code."
echo ""

# Google Client Secret
echo "1. Google OAuth Client Secret"
echo "   (from Google Cloud Console > APIs & Services > Credentials)"
wrangler secret put GOOGLE_CLIENT_SECRET --config "$CONFIG_FILE" --env "$ENV"

# GitHub Client Secret  
echo ""
echo "2. GitHub OAuth Client Secret"
echo "   (from GitHub > Settings > Developer settings > OAuth Apps)"
wrangler secret put GITHUB_CLIENT_SECRET --config "$CONFIG_FILE" --env "$ENV"

# JWT Secret
echo ""
echo "3. JWT Secret (for token signing)"
echo "   You can generate one with: openssl rand -base64 32"
echo "   Or use any secure random string (minimum 32 characters)"
wrangler secret put JWT_SECRET --config "$CONFIG_FILE" --env "$ENV"

# 5. デプロイ実行
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying HierarchiDB BFF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENV_NAME"
echo "Config file: $CONFIG_FILE"
echo ""

if [ "$ENV" = "production" ]; then
    wrangler deploy --config "$CONFIG_FILE" --env production
else
    wrangler deploy --config "$CONFIG_FILE" --env development
fi

# 6. デプロイ結果
if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✅ Deployment Successful!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Your BFF is now available at:"
    if [ "$ENV" = "production" ]; then
        echo -e "${GREEN}  https://hierarchidb-bff.kubohiroya.workers.dev${NC}"
        echo ""
        echo "Supported origins:"
        echo "  • https://kubohiroya.github.io"
        echo "  • https://hierarchidb.vercel.app"  
        echo "  • https://hierarchidb.netlify.app"
    else
        echo -e "${GREEN}  https://hierarchidb-bff-dev.kubohiroya.workers.dev${NC}"
        echo ""
        echo "Supported origins:"
        echo "  • http://localhost:4200"
        echo "  • http://localhost:5173"
    fi
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Update frontend environment variables:"
    echo "   └─ scripts/env/development.sh"
    echo "   └─ scripts/env/production.sh"
    echo "      export VITE_BFF_BASE_URL=\"https://hierarchidb-bff.kubohiroya.workers.dev\""
    echo ""
    echo "2. Test authentication flow:"
    echo "   pnpm dev"
    echo "   Open http://localhost:4200 and test login"
    echo ""
    echo "3. Monitor logs:"
    echo "   wrangler tail --config $CONFIG_FILE --env $ENV"
    echo ""
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${RED}❌ Deployment Failed${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Please check the error messages above."
    echo "Common issues:"
    echo "  • Invalid wrangler.toml configuration"
    echo "  • Missing required secrets"
    echo "  • Network connectivity issues"
    echo ""
    exit 1
fi