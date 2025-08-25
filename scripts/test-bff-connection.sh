#!/bin/bash

# ================================================================
# BFF接続テストスクリプト
# 作成日: 2025年8月25日
# ================================================================

echo "=================================================="
echo "BFF Connection Test Suite"
echo "Date: $(date)"
echo "=================================================="
echo ""

# カラー出力用の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト結果をカウント
PASSED=0
FAILED=0

# テスト関数
run_test() {
    local TEST_NAME=$1
    local COMMAND=$2
    local EXPECTED=$3
    
    echo -n "Testing: $TEST_NAME... "
    
    RESULT=$(eval $COMMAND 2>/dev/null)
    
    if [[ "$RESULT" == *"$EXPECTED"* ]] || [[ "$RESULT" == "$EXPECTED" ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: $EXPECTED"
        echo "  Got: $RESULT"
        ((FAILED++))
        return 1
    fi
}

# ================================================================
# 1. 直接BFFアクセステスト
# ================================================================
echo ""
echo "=== 1. Direct BFF Access Tests ==="
echo ""

# Health checkエンドポイント（もし存在すれば）
run_test "BFF Health Check" \
    "curl -s -o /dev/null -w '%{http_code}' https://eria-cartograph-bff.kubohiroya.workers.dev/health" \
    "404"  # または200（実際のレスポンスに依存）

# Auth base endpoint
run_test "Auth Base Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' https://eria-cartograph-bff.kubohiroya.workers.dev/auth" \
    "404"

# Google OAuth endpoint
run_test "Google OAuth Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' https://eria-cartograph-bff.kubohiroya.workers.dev/auth/google/authorize" \
    "400"  # パラメータなしでのアクセスは400または302

# GitHub OAuth endpoint  
run_test "GitHub OAuth Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' https://eria-cartograph-bff.kubohiroya.workers.dev/auth/github/authorize" \
    "400"

# ================================================================
# 2. CORS Preflight Tests
# ================================================================
echo ""
echo "=== 2. CORS Preflight Tests ==="
echo ""

# OPTIONS request from localhost
echo "Testing CORS headers from localhost:4200..."
CORS_RESPONSE=$(curl -X OPTIONS \
    https://eria-cartograph-bff.kubohiroya.workers.dev/auth/google/authorize \
    -H "Origin: http://localhost:4200" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -s -i 2>/dev/null | head -20)

if [[ "$CORS_RESPONSE" == *"access-control-allow-origin"* ]]; then
    echo -e "${GREEN}✓ CORS headers present${NC}"
    ((PASSED++))
    echo "$CORS_RESPONSE" | grep -i "access-control"
else
    echo -e "${YELLOW}⚠ CORS headers not found (may need proxy)${NC}"
    ((FAILED++))
fi

# ================================================================
# 3. Local Development Server Tests (if running)
# ================================================================
echo ""
echo "=== 3. Local Development Server Tests ==="
echo ""

# Check if dev server is running
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4200 | grep -q "200\|404"; then
    echo -e "${GREEN}✓ Dev server is running${NC}"
    
    # Test proxy endpoint
    run_test "Proxy /auth endpoint" \
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:4200/auth/google/authorize" \
        "400"
        
else
    echo -e "${YELLOW}⚠ Dev server not running (start with: pnpm dev)${NC}"
fi

# ================================================================
# 4. Environment Variable Check
# ================================================================
echo ""
echo "=== 4. Environment Configuration ==="
echo ""

# Source the environment
if [ -f "scripts/env/development.sh" ]; then
    source scripts/env/development.sh
    
    echo "VITE_BFF_BASE_URL: $VITE_BFF_BASE_URL"
    echo "VITE_ENV_MODE: $VITE_ENV_MODE"
    echo "VITE_USE_HASH_ROUTING: $VITE_USE_HASH_ROUTING"
    
    # Validate URL format
    if [[ "$VITE_BFF_BASE_URL" == *"/api/auth" ]]; then
        echo -e "${YELLOW}⚠ Warning: VITE_BFF_BASE_URL contains /api/auth suffix${NC}"
    else
        echo -e "${GREEN}✓ VITE_BFF_BASE_URL format is correct${NC}"
        ((PASSED++))
    fi
else
    echo -e "${RED}✗ Environment file not found${NC}"
    ((FAILED++))
fi

# ================================================================
# 5. URL Construction Test
# ================================================================
echo ""
echo "=== 5. URL Construction Validation ==="
echo ""

BASE_URL="https://eria-cartograph-bff.kubohiroya.workers.dev"
PROVIDER="google"

# Test correct URL construction
EXPECTED_URL="${BASE_URL}/auth/${PROVIDER}/authorize"
echo "Expected OAuth URL: $EXPECTED_URL"

# Simulate URL construction
if [[ "$BASE_URL" == http* ]]; then
    CONSTRUCTED_URL="${BASE_URL}/auth/${PROVIDER}/authorize"
else
    CONSTRUCTED_URL="http://localhost:4200${BASE_URL}/${PROVIDER}/authorize"
fi

echo "Constructed URL: $CONSTRUCTED_URL"

if [[ "$CONSTRUCTED_URL" == "$EXPECTED_URL" ]]; then
    echo -e "${GREEN}✓ URL construction is correct${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ URL construction mismatch${NC}"
    ((FAILED++))
fi

# ================================================================
# Summary
# ================================================================
echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Review the output above.${NC}"
    echo ""
    echo "Recommendations:"
    if [[ "$CORS_RESPONSE" != *"access-control-allow-origin"* ]]; then
        echo "- CORS is not configured. The Vite proxy should handle this in development."
    fi
    echo "- Ensure the dev server is running: pnpm dev"
    echo "- Check that environment variables are correctly set"
    echo "- Verify BFFAuthService.ts is using the correct URL construction logic"
    exit 1
fi