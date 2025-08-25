/**
 * セキュリティミドルウェア
 * 複数デプロイ先対応のセキュリティ機能
 */

export interface Env {
  ALLOWED_ORIGINS: string;
  PRODUCTION_ORIGINS?: string;
  STAGING_ORIGINS?: string;
  DEVELOPMENT_ORIGINS?: string;
  ENABLE_RATE_LIMIT?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  ENABLE_AUDIT_LOG?: string;
  LOG_LEVEL?: string;
  ENABLE_SECURITY_HEADERS?: string;
  CSP_REPORT_URI?: string;
  RATE_LIMIT_KV?: KVNamespace;
  AUDIT_LOG_KV?: KVNamespace;
  JWT_EXPIRY_HOURS_PROD?: string;
  JWT_EXPIRY_HOURS_STAGING?: string;
  JWT_EXPIRY_HOURS_DEV?: string;
}

/**
 * Origin検証とCORS設定
 */
export function validateOrigin(request: Request, env: Env): {
  isValid: boolean;
  origin: string | null;
  environment: 'production' | 'staging' | 'development' | 'unknown';
} {
  const origin = request.headers.get('Origin');
  
  if (!origin) {
    return { isValid: false, origin: null, environment: 'unknown' };
  }

  // 許可されたOriginのリストを取得
  const allowedOrigins = env.ALLOWED_ORIGINS
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  // Origin が許可リストに含まれているか確認
  const isValid = allowedOrigins.includes(origin);

  // 環境を判定
  let environment: 'production' | 'staging' | 'development' | 'unknown' = 'unknown';
  
  if (env.PRODUCTION_ORIGINS?.split(',').some(o => o.trim() === origin)) {
    environment = 'production';
  } else if (env.STAGING_ORIGINS?.split(',').some(o => o.trim() === origin)) {
    environment = 'staging';
  } else if (env.DEVELOPMENT_ORIGINS?.split(',').some(o => o.trim() === origin)) {
    environment = 'development';
  }

  return { isValid, origin, environment };
}

/**
 * CORSヘッダーを追加
 */
export function addCorsHeaders(response: Response, origin: string | null, env: Env): Response {
  const headers = new Headers(response.headers);
  
  if (origin) {
    // 許可されたOriginのみ返す（セキュリティ強化）
    const { isValid } = validateOrigin(new Request('https://example.com', { headers: { Origin: origin } }), env);
    if (isValid) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400'); // 24時間

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * レート制限チェック
 */
export async function checkRateLimit(
  request: Request,
  env: Env
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.ENABLE_RATE_LIMIT !== 'true' || !env.RATE_LIMIT_KV) {
    return { allowed: true, remaining: 999 };
  }

  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For')?.split(',')[0] || 
             'unknown';
  
  const key = `ratelimit:${ip}`;
  const limit = parseInt(env.RATE_LIMIT_PER_MINUTE || '30');
  const now = Date.now();
  const window = 60000; // 1分

  // 現在のカウントを取得
  const data = await env.RATE_LIMIT_KV.get(key, 'json') as { count: number; resetAt: number } | null;

  if (!data || data.resetAt < now) {
    // 新しいウィンドウを開始
    await env.RATE_LIMIT_KV.put(key, JSON.stringify({
      count: 1,
      resetAt: now + window
    }), { expirationTtl: 60 });
    
    return { allowed: true, remaining: limit - 1 };
  }

  if (data.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // カウントを増やす
  data.count++;
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(data), { 
    expirationTtl: Math.ceil((data.resetAt - now) / 1000) 
  });

  return { allowed: true, remaining: limit - data.count };
}

/**
 * セキュリティヘッダーを追加
 */
export function addSecurityHeaders(response: Response, env: Env): Response {
  if (env.ENABLE_SECURITY_HEADERS !== 'true') {
    return response;
  }

  const headers = new Headers(response.headers);
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React開発用
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://hierarchidb-bff.kubohiroya.workers.dev",
    "frame-ancestors 'none'"
  ];

  if (env.CSP_REPORT_URI) {
    cspDirectives.push(`report-uri ${env.CSP_REPORT_URI}`);
  }

  headers.set('Content-Security-Policy', cspDirectives.join('; '));
  
  // その他のセキュリティヘッダー
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * 監査ログを記録
 */
export async function logAuditEvent(
  event: {
    type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'logout';
    userId?: string;
    email?: string;
    provider?: string;
    origin: string | null;
    environment: string;
    ip: string;
    userAgent: string | null;
    error?: string;
  },
  env: Env
): Promise<void> {
  if (env.ENABLE_AUDIT_LOG !== 'true' || !env.AUDIT_LOG_KV) {
    console.log('[Audit]', JSON.stringify(event));
    return;
  }

  const timestamp = new Date().toISOString();
  const key = `audit:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
  
  const logEntry = {
    ...event,
    timestamp,
    level: event.type.includes('failure') ? 'error' : 'info'
  };

  // KVに保存（24時間後に自動削除）
  await env.AUDIT_LOG_KV.put(key, JSON.stringify(logEntry), {
    expirationTtl: 86400
  });

  // エラーの場合は追加のアラート処理
  if (event.type === 'auth_failure' && event.error) {
    await checkForSuspiciousActivity(event.ip, env);
  }
}

/**
 * 不審なアクティビティをチェック
 */
async function checkForSuspiciousActivity(ip: string, env: Env): Promise<void> {
  if (!env.AUDIT_LOG_KV) return;

  const key = `suspicious:${ip}`;
  const data = await env.AUDIT_LOG_KV.get(key, 'json') as { count: number; firstSeen: number } | null;
  const now = Date.now();

  if (!data) {
    await env.AUDIT_LOG_KV.put(key, JSON.stringify({
      count: 1,
      firstSeen: now
    }), { expirationTtl: 3600 }); // 1時間
    return;
  }

  data.count++;
  
  // 1時間以内に5回以上の失敗
  if (data.count >= 5 && (now - data.firstSeen) < 3600000) {
    console.error(`[Security Alert] Suspicious activity from IP: ${ip}, failures: ${data.count}`);
    // TODO: アラート送信やIPブロックの実装
  }

  await env.AUDIT_LOG_KV.put(key, JSON.stringify(data), {
    expirationTtl: Math.ceil((data.firstSeen + 3600000 - now) / 1000)
  });
}

/**
 * 環境に応じたJWT有効期限を取得
 */
export function getJwtExpiry(environment: string, env: Env): number {
  const hours = environment === 'production' 
    ? parseInt(env.JWT_EXPIRY_HOURS_PROD || '2')
    : environment === 'staging'
    ? parseInt(env.JWT_EXPIRY_HOURS_STAGING || '8')
    : parseInt(env.JWT_EXPIRY_HOURS_DEV || '24');
  
  return hours * 3600; // 秒単位で返す
}

/**
 * セキュリティミドルウェアの統合関数
 */
export async function handleSecurity(
  request: Request,
  env: Env,
  handler: () => Promise<Response>
): Promise<Response> {
  // 1. Origin検証
  const { isValid, origin, environment } = validateOrigin(request, env);
  
  if (!isValid && request.method !== 'OPTIONS') {
    await logAuditEvent({
      type: 'auth_failure',
      origin,
      environment: 'unknown',
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent'),
      error: 'Invalid origin'
    }, env);
    
    return new Response('Forbidden', { status: 403 });
  }

  // 2. レート制限
  const { allowed, remaining } = await checkRateLimit(request, env);
  
  if (!allowed) {
    return new Response('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Remaining': '0'
      }
    });
  }

  // 3. OPTIONSリクエストの処理
  if (request.method === 'OPTIONS') {
    const response = new Response(null, { status: 204 });
    return addCorsHeaders(response, origin, env);
  }

  // 4. メインハンドラーの実行
  let response = await handler();

  // 5. レスポンスヘッダーの追加
  response = addCorsHeaders(response, origin, env);
  response = addSecurityHeaders(response, env);
  
  // レート制限情報をヘッダーに追加
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', remaining.toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}