#!/bin/bash

# ====================================
# HierarchiDB BFF Verification Script
# ====================================

BFF_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "HierarchiDB BFF Verification"
echo "Target: ${BFF_URL}"
echo "======================================"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Function to check test result
check_result() {
    if [ "$1" = "true" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAIL_COUNT++))
    fi
}

# 1. Health Check
echo -n "1. Health Check... "
HEALTH_RESPONSE=$(curl -s ${BFF_URL}/health 2>/dev/null)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    check_result "true"
    echo "   Response: $(echo $HEALTH_RESPONSE | jq -c .)"
else
    check_result "false"
    echo "   Error: No healthy status returned"
fi
echo ""

# 2. OpenID Configuration
echo -n "2. OpenID Configuration... "
OIDC_RESPONSE=$(curl -s ${BFF_URL}/.well-known/openid-configuration 2>/dev/null)
if echo "$OIDC_RESPONSE" | grep -q '"issuer":"hierarchidb-bff"'; then
    check_result "true"
else
    check_result "false"
    echo "   Error: Invalid OpenID configuration"
fi
echo ""

# 3. CORS Configuration for localhost
echo -n "3. CORS (localhost:4200)... "
CORS_HEADERS=$(curl -s -H "Origin: http://localhost:4200" -I ${BFF_URL}/health 2>/dev/null)
if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Origin: http://localhost:4200"; then
    check_result "true"
else
    check_result "false"
    echo "   Error: CORS not configured for localhost:4200"
fi
echo ""

# 4. CORS Configuration for GitHub Pages
echo -n "4. CORS (GitHub Pages)... "
CORS_GH=$(curl -s -H "Origin: https://kubohiroya.github.io" -I ${BFF_URL}/health 2>/dev/null)
if echo "$CORS_GH" | grep -q "Access-Control-Allow-Origin: https://kubohiroya.github.io"; then
    check_result "true"
else
    check_result "false"
    echo "   Error: CORS not configured for GitHub Pages"
fi
echo ""

# 5. Invalid Origin Rejection
echo -n "5. Invalid Origin Rejection... "
INVALID_ORIGIN=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://malicious.com" ${BFF_URL}/health 2>/dev/null)
if [ "$INVALID_ORIGIN" = "403" ]; then
    check_result "true"
else
    check_result "false"
    echo "   Error: Invalid origin not rejected (Status: $INVALID_ORIGIN)"
fi
echo ""

# 6. Google OAuth Endpoint
echo -n "6. Google OAuth Endpoint... "
GOOGLE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BFF_URL}/auth/google/authorize 2>/dev/null)
GOOGLE_LOCATION=$(curl -s -I ${BFF_URL}/auth/google/authorize 2>/dev/null | grep -i "location:" | grep -o "accounts.google.com")
if [ "$GOOGLE_STATUS" = "302" ] && [ "$GOOGLE_LOCATION" ]; then
    check_result "true"
else
    check_result "false"
    echo "   Error: Google OAuth redirect not working (Status: $GOOGLE_STATUS)"
fi
echo ""

# 7. GitHub OAuth Endpoint
echo -n "7. GitHub OAuth Endpoint... "
GITHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BFF_URL}/auth/github/authorize 2>/dev/null)
GITHUB_LOCATION=$(curl -s -I ${BFF_URL}/auth/github/authorize 2>/dev/null | grep -i "location:" | grep -o "github.com")
if [ "$GITHUB_STATUS" = "302" ] && [ "$GITHUB_LOCATION" ]; then
    check_result "true"
else
    check_result "false"
    echo "   Error: GitHub OAuth redirect not working (Status: $GITHUB_STATUS)"
fi
echo ""

# 8. Security Headers
echo -n "8. Security Headers... "
HEADERS=$(curl -s -I ${BFF_URL}/health 2>/dev/null)
CSP=$(echo "$HEADERS" | grep -i "Content-Security-Policy")
XFO=$(echo "$HEADERS" | grep -i "X-Frame-Options")
XCTO=$(echo "$HEADERS" | grep -i "X-Content-Type-Options")
if [ "$CSP" ] && [ "$XFO" ] && [ "$XCTO" ]; then
    check_result "true"
    echo "   ✓ CSP, X-Frame-Options, X-Content-Type-Options present"
else
    check_result "false"
    echo "   Error: Missing security headers"
fi
echo ""

# 9. Rate Limiting Headers
echo -n "9. Rate Limiting... "
RATE_LIMIT=$(curl -s -I -H "Origin: http://localhost:4200" ${BFF_URL}/health 2>/dev/null | grep -i "X-RateLimit-Remaining")
if [ "$RATE_LIMIT" ]; then
    check_result "true"
    echo "   $RATE_LIMIT"
else
    check_result "false"
    echo "   Warning: Rate limiting headers not found"
fi
echo ""

# 10. Invalid Token Handling
echo -n "10. Invalid Token Handling... "
INVALID_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid-token" ${BFF_URL}/auth/userinfo 2>/dev/null)
if [ "$INVALID_TOKEN" = "401" ] || [ "$INVALID_TOKEN" = "403" ]; then
    check_result "true"
else
    check_result "false"
    echo "   Error: Invalid token not rejected (Status: $INVALID_TOKEN)"
fi
echo ""

# Performance Test
echo "11. Performance Test:"
echo -n "    Average response time (5 requests): "
TOTAL_TIME=0
for i in {1..5}; do
    TIME=$(curl -o /dev/null -s -w "%{time_total}" ${BFF_URL}/health 2>/dev/null)
    TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME" | bc)
done
AVG_TIME=$(echo "scale=3; $TOTAL_TIME / 5" | bc)
echo "${AVG_TIME}s"

if (( $(echo "$AVG_TIME < 0.5" | bc -l) )); then
    echo -e "    ${GREEN}✓ Good performance (<500ms)${NC}"
    ((PASS_COUNT++))
elif (( $(echo "$AVG_TIME < 1.0" | bc -l) )); then
    echo -e "    ${YELLOW}⚠ Acceptable performance (<1s)${NC}"
    ((PASS_COUNT++))
else
    echo -e "    ${RED}✗ Poor performance (>1s)${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Summary
echo "======================================"
echo "Verification Summary"
echo "======================================"
echo -e "Passed: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Failed: ${RED}${FAIL_COUNT}${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed! BFF is working correctly.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please check the errors above.${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check wrangler logs: wrangler tail"
    echo "2. Verify OAuth Client IDs in wrangler.toml"
    echo "3. Confirm secrets are set: wrangler secret list"
    echo "4. Check deployment status: wrangler deployments list"
    exit 1
fi