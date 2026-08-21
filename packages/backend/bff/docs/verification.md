# HierarchiDB BFF Verification Guide

新しくデプロイしたBFFが正しく動作していることを確認するための包括的な検証手順です。

## 1. 基本的な動作確認

### 1.1 ヘルスチェック

```bash
# BFFの稼働状態を確認
curl https://hierarchidb-bff.kubohiroya.workers.dev/health

# 期待される応答:
{
  "status": "healthy",
  "environment": "production",
  "origins": [
    "http://localhost:4200",
    "https://kubohiroya.github.io",
    "https://hierarchidb.vercel.app",
    "https://hierarchidb.netlify.app"
  ],
  "timestamp": "2025-08-25T10:00:00Z"
}
```

### 1.2 OpenID Connect Discovery

```bash
# OpenID設定エンドポイントの確認
curl https://hierarchidb-bff.kubohiroya.workers.dev/.well-known/openid-configuration

# 期待される応答:
{
  "issuer": "hierarchidb-bff",
  "authorization_endpoint": "https://hierarchidb-bff.kubohiroya.workers.dev/auth/authorize",
  "token_endpoint": "https://hierarchidb-bff.kubohiroya.workers.dev/auth/token",
  "userinfo_endpoint": "https://hierarchidb-bff.kubohiroya.workers.dev/auth/userinfo",
  "jwks_uri": "https://hierarchidb-bff.kubohiroya.workers.dev/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["HS256"]
}
```

## 2. OAuth認証フローのテスト

### 2.1 Google OAuth認証URL確認

```bash
# リダイレクトが正しく設定されているか確認
curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/authorize/google

# 期待される応答:
HTTP/2 302
Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=...
```

### 2.2 GitHub OAuth認証URL確認

```bash
# リダイレクトが正しく設定されているか確認
curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/authorize/github

# 期待される応答:
HTTP/2 302
Location: https://github.com/login/oauth/authorize?client_id=...
```

## 3. CORS設定の検証

### 3.1 許可されたOriginからのリクエスト

```bash
# localhost:4200からのリクエストをシミュレート
curl -H "Origin: http://localhost:4200" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://hierarchidb-bff.kubohiroya.workers.dev/auth/token

# 期待される応答ヘッダー:
Access-Control-Allow-Origin: http://localhost:4200
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

### 3.2 許可されていないOriginからのリクエスト

```bash
# 不正なOriginからのリクエスト
curl -H "Origin: http://malicious-site.com" \
     -X GET \
     https://hierarchidb-bff.kubohiroya.workers.dev/auth/status

# 期待される応答:
HTTP/2 403 Forbidden
```

## 4. リアルタイムログ監視

```bash
# Cloudflare Workersのログをリアルタイムで確認
wrangler tail --format pretty

# 本番環境のログのみ
wrangler tail --env production --format pretty

# エラーのみフィルタリング
wrangler tail --format pretty | grep -E "error|Error|ERROR"
```

## 5. ブラウザでの統合テスト

### 5.1 開発環境でのテスト

1. **開発サーバー起動**
   ```bash
   cd /path/to/hierarchidb
   pnpm dev
   ```

2. **ブラウザでアクセス**
   ```
   http://localhost:4200
   ```

3. **認証フローテスト**
   - 「Sign in with Google」をクリック
   - Googleアカウントでログイン
   - HierarchiDBにリダイレクトされることを確認
   - ユーザー情報が表示されることを確認

4. **開発者ツールで確認**
   ```javascript
   // ブラウザのコンソールで実行
   // LocalStorageのJWTトークン確認
   console.log(localStorage.getItem('access_token'));
   
   // トークンのデコード（JWTの内容確認）
   const token = localStorage.getItem('access_token');
   if (token) {
     const payload = JSON.parse(atob(token.split('.')[1]));
     console.log('Token payload:', payload);
     console.log('Expires at:', new Date(payload.exp * 1000));
   }
   ```

### 5.2 本番環境でのテスト

1. **GitHub Pagesアクセス**
   ```
   https://kubohiroya.github.io/hierarchidb
   ```

2. **同様の認証フローテスト実施**

## 6. セキュリティ機能の検証

### 6.1 レート制限の確認

```bash
# 短時間に多数のリクエストを送信
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Origin: http://localhost:4200" \
    https://hierarchidb-bff.kubohiroya.workers.dev/health
  sleep 0.1
done

# 21回目以降で429 (Too Many Requests)が返ることを確認
```

### 6.2 セキュリティヘッダーの確認

```bash
# レスポンスヘッダーを確認
curl -I https://hierarchidb-bff.kubohiroya.workers.dev/health

# 期待されるセキュリティヘッダー:
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

## 7. エラーケースのテスト

### 7.1 token exchangeのprovider契約

```bash
curl -i \
  -H "Origin: https://kubohiroya.github.io" \
  -H "Content-Type: application/json" \
  --data '{"code":"invalid-test-code"}' \
  https://hierarchidb-bff.kubohiroya.workers.dev/auth/token
```

期待結果:

- HTTP 400 `invalid_request`
- providerをGoogleとして補完しない
- Cloudflare logにauthorization codeを出力しない

`provider=unknown` も同じくHTTP 400で拒否する。

### 7.2 無効なトークンでのアクセス

```bash
# 無効なJWTトークンでユーザー情報取得を試行
curl -H "Authorization: Bearer invalid-token" \
     https://hierarchidb-bff.kubohiroya.workers.dev/auth/userinfo

# 期待される応答:
{
  "error": "invalid_token",
  "error_description": "The access token is invalid"
}
```

### 7.3 期限切れトークンのテスト

```javascript
// ブラウザコンソールで実行
// 古いトークンをセット（テスト用）
const expiredToken = "eyJ..."; // 期限切れのトークン
localStorage.setItem('access_token', expiredToken);

// APIコール実行
fetch('https://hierarchidb-bff.kubohiroya.workers.dev/auth/userinfo', {
  headers: {
    'Authorization': `Bearer ${expiredToken}`
  }
}).then(res => res.json()).then(console.log);

// 期待される応答: 401 Unauthorized
```

## 8. パフォーマンステスト

### 8.1 レスポンスタイム測定

```bash
# 10回の平均レスポンスタイムを測定
for i in {1..10}; do
  curl -o /dev/null -s -w "Time: %{time_total}s\n" \
    https://hierarchidb-bff.kubohiroya.workers.dev/health
done

# 期待値: < 100ms
```

### 8.2 並行リクエストテスト

```bash
# 5つの並行リクエスト
for i in {1..5}; do
  curl https://hierarchidb-bff.kubohiroya.workers.dev/health &
done
wait

# すべて正常に応答することを確認
```

## 9. session modeと `AUTH_KV` の確認

最初に対象環境の `AUTH_SESSION_MODE` と `SESSION_DURATION_HOURS` を確認する。両方とも必須であり、
checked-in設定の期限は4時間である。現行BFFが `persistent` modeの認証sessionに使用するbindingは
`AUTH_KV` だけである。旧文書の `RATE_LIMIT_KV`、`AUDIT_LOG_KV`、`SESSION_KV` は対象ではない。

```bash
cd packages/backend/bff

# persistentの場合だけCloudflare account内にnamespaceが存在することを確認
pnpm exec wrangler kv namespace list

# production bindingを解決できることをdeploy前に確認
pnpm exec wrangler deploy --dry-run \
  --config wrangler.hierarchidb.toml \
  --env production
```

`persistent` のデプロイ後は次を順に確認する。

1. 新規loginが `session_mode=persistent` と `refresh_token_id` を返し、警告が表示されない。
2. token refreshが成功する。
3. revokeが成功する。
4. revoke済みsessionのrefreshが `Session not found` で失敗する。
5. Workerログに `AUTH_KV is not configured` またはKV read/write/delete失敗がない。

`persistent` で未bindingまたはKVエラーを意図的に検証する場合の期待結果は次のとおり。

| 操作 | 期待結果 |
| --- | --- |
| login/token exchange | `session_mode=stateless` の短命tokenと `operation=login`、`action=none` の警告を返す |
| refresh | HTTP 503と `operation=refresh`、`action=relogin` の警告を返す |
| revoke | HTTP 2xxのローカル完了と `operation=revoke`、`action=none` の警告を返す |
| logout | HTTP 2xxのローカル完了と `operation=logout`、`action=none` の警告を返す |

quota超過とその他のKV障害は、どちらも `reason=kv_error` になる。quota上限とreset条件は
Cloudflareの契約planおよび管理画面で確認し、この文書の固定値を根拠にしない。

`stateless` のデプロイ後は次を確認する。

1. 新規loginが `session_mode=stateless` を返し、`refresh_token_id` とKV警告を含まない。
2. BFFとUIが `AUTH_KV` を参照せず、token期限の5分前にも `/auth/refresh` を呼ばない。
3. token期限切れ時にlocal sessionが削除され、次の認証時にloginをやり直せる。
4. `/auth/refresh` を直接呼ぶとHTTP 401 `reauthentication_required` が警告なしで返る。
5. revoke/logoutがローカル完了し、KV警告を返さない。

key一覧の確認が必要な場合は、[BFF `AUTH_KV` 運用仕様](./auth-kv-operations.md)の機密情報に関する
注意事項とロールバック手順に従う。

## 10. 包括的な検証スクリプト

```bash
#!/bin/bash
# verify-bff.sh

BFF_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "======================================"
echo "HierarchiDB BFF Verification"
echo "======================================"

# 1. Health Check
echo -n "1. Health Check... "
HEALTH=$(curl -s ${BFF_URL}/health | grep -o '"status":"healthy"')
if [ "$HEALTH" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# 2. CORS Check
echo -n "2. CORS Configuration... "
CORS=$(curl -s -H "Origin: http://localhost:4200" -I ${BFF_URL}/health | grep -o "Access-Control-Allow-Origin")
if [ "$CORS" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# 3. OAuth Endpoints
echo -n "3. Google OAuth Endpoint... "
GOOGLE=$(curl -s -o /dev/null -w "%{http_code}" ${BFF_URL}/auth/authorize/google)
if [ "$GOOGLE" = "302" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo -n "4. GitHub OAuth Endpoint... "
GITHUB=$(curl -s -o /dev/null -w "%{http_code}" ${BFF_URL}/auth/authorize/github)
if [ "$GITHUB" = "302" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# 5. Security Headers
echo -n "5. Security Headers... "
CSP=$(curl -s -I ${BFF_URL}/health | grep -o "Content-Security-Policy")
if [ "$CSP" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo "======================================"
echo "Verification Complete!"
```

このスクリプトを実行：
```bash
chmod +x verify-bff.sh
./verify-bff.sh
```

## 11. トラブルシューティング

問題が発生した場合の確認事項：

1. **Client IDの確認**
   ```bash
   # wrangler.tomlの設定確認
   grep "CLIENT_ID" wrangler.toml
   ```

2. **Secretsの確認**
   ```bash
   # 設定されているシークレットのリスト
   wrangler secret list
   ```

3. **デプロイ状態の確認**
   ```bash
   # 最新のデプロイ情報
   wrangler deployments list
   ```

4. **エラーログの詳細確認**
   ```bash
   # 過去1時間のエラーログ
   wrangler tail --format json | jq 'select(.level=="error")'
   ```

## 検証成功の基準

以下のすべてが確認できれば、BFFは正常に動作しています：

- ✅ ヘルスチェックが "healthy" を返す
- ✅ OAuth認証URLへのリダイレクトが機能する
- ✅ CORSが正しく設定されている
- ✅ セキュリティヘッダーが適用されている
- ✅ レート制限が機能している
- ✅ ブラウザから認証フローが完了できる
- ✅ JWTトークンが正しく生成・検証される

これらすべてが確認できれば、HierarchiDB BFFは本番環境で使用する準備が整っています。
