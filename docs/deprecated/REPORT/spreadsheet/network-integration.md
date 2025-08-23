# Spreadsheet Plugin - Network Integration

## 依存関係

### ui-auth依存

plugin-spreadsheetパッケージは`@hierarchidb/ui-auth`への依存が必要です：

```json
{
  "dependencies": {
    "@hierarchidb/ui-auth": "workspace:*"
  }
}
```

### 理由
- URLからのスプレッドシートファイル取得時の認証が必要
- プライベートなGoogle Sheets、OneDrive、SharePointへのアクセス
- 企業内部のファイルサーバーへのアクセス制御

## BFF/CORS Proxy併用

### 推奨アーキテクチャ

```
UI (plugin-spreadsheet)
  ↓
ui-auth (OAuth2/OIDC)
  ↓
BFF (Cloudflare Worker)
  ↓
CORS Proxy
  ↓
External APIs/File Servers
```

### BFF (Backend for Frontend)
- **認証トークン管理**: OAuth2/OIDCトークンの安全な管理
- **APIキー保護**: Google Sheets API、Microsoft Graph APIキーの秘匿
- **レート制限**: 外部APIへのアクセス制御
- **セキュリティヘッダー**: CSPなどのセキュリティ強化

### CORS Proxy
- **CORS回避**: 外部ファイルサーバーのCORS制限回避
- **プロトコル変換**: HTTP/HTTPSプロトコルの統一
- **ヘッダー正規化**: Content-Typeなどのヘッダー統一

## Cache API活用

### 実装方針

```typescript
export class CachedFileLoader extends FileLoader {
  private cache: Cache | null = null;

  async initCache(): Promise<void> {
    if ('caches' in window) {
      this.cache = await caches.open('spreadsheet-files-v1');
    }
  }

  async importFromURL(
    url: string,
    options: SpreadsheetImportOptions = {}
  ): Promise<SpreadsheetImportResult> {
    await this.initCache();
    
    // Check cache first
    if (this.cache) {
      const cachedResponse = await this.cache.match(url);
      if (cachedResponse && !this.isCacheExpired(cachedResponse)) {
        const blob = await cachedResponse.blob();
        const file = new File([blob], this.getFilenameFromURL(url));
        return await this.importFromFile(file, options);
      }
    }

    // Fetch from network
    const response = await this.fetchWithAuth(url);
    
    // Cache the response
    if (this.cache && response.ok) {
      await this.cache.put(url, response.clone());
    }

    const blob = await response.blob();
    const file = new File([blob], this.getFilenameFromURL(url));
    return await this.importFromFile(file, options);
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    const authContext = useAuthContext();
    const headers: HeadersInit = {};

    // Add authentication headers if available
    if (authContext.accessToken) {
      headers['Authorization'] = `Bearer ${authContext.accessToken}`;
    }

    return fetch(url, { headers });
  }

  private isCacheExpired(response: Response): boolean {
    const cacheControl = response.headers.get('Cache-Control');
    if (!cacheControl) return false;

    const maxAge = cacheControl.match(/max-age=(\d+)/);
    if (!maxAge) return false;

    const responseDate = new Date(response.headers.get('Date') || '');
    const expiryTime = responseDate.getTime() + parseInt(maxAge[1]) * 1000;
    
    return Date.now() > expiryTime;
  }
}
```

### キャッシュ戦略

1. **ファイルキャッシュ**
   - 大きなスプレッドシートファイルの重複ダウンロード防止
   - TTL: 1時間（設定可能）
   - 容量制限: 100MB

2. **メタデータキャッシュ**
   - ファイルサイズ、更新日時などの軽量メタデータ
   - TTL: 5分
   - 高頻度アクセス用

3. **チャンクキャッシュ**
   - 処理済みチャンクデータのキャッシュ
   - IndexedDBとの連携
   - LRU方式での自動削除

## 外部サービス連携

### Google Sheets API
```typescript
// BFF経由でのアクセス
const sheetsUrl = `/api/bff/google-sheets/${sheetId}`;
const response = await fetch(sheetsUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Microsoft Graph API
```typescript
// OneDrive/SharePointファイルアクセス
const graphUrl = `/api/bff/microsoft-graph/files/${fileId}`;
const response = await fetch(graphUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 一般的なファイルURL
```typescript
// CORS Proxy経由
const proxyUrl = `/api/cors-proxy?url=${encodeURIComponent(originalUrl)}`;
const response = await fetch(proxyUrl);
```

## セキュリティ考慮事項

### 1. 認証情報の保護
- アクセストークンはBFFでのみ管理
- フロントエンドでは短期間のセッショントークンのみ保持

### 2. CSP (Content Security Policy)
```
Content-Security-Policy: 
  default-src 'self';
  connect-src 'self' https://bff.example.com https://cors-proxy.example.com;
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
```

### 3. HTTPS必須
- 全ての外部通信はHTTPS
- 混合コンテンツの防止

### 4. ファイルサイズ制限
- 単一ファイル: 500MB
- 同時ダウンロード: 3ファイルまで
- 総キャッシュ容量: 1GB

## エラーハンドリング

### ネットワークエラー
```typescript
export enum NetworkErrorCode {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CACHE_FULL = 'CACHE_FULL',
}
```

### リトライ戦略
- 指数バックオフ: 1s, 2s, 4s, 8s
- 最大リトライ回数: 3回
- 認証エラー時は即座にリダイレクト

## パフォーマンス最適化

### 1. プリロード
```typescript
// 予測的なファイルロード
const preloadHints = document.querySelectorAll('link[rel="preload"][as="fetch"]');
```

### 2. 並列ダウンロード
```typescript
// 複数ファイルの並列処理
const results = await Promise.allSettled(urls.map(url => 
  fileLoader.importFromURL(url)
));
```

### 3. プログレッシブロード
```typescript
// 大きなファイルの段階的読み込み
const chunks = await fileLoader.importFromURLWithProgress(url, {
  onProgress: (loaded, total) => {
    updateProgressBar(loaded / total);
  }
});
```

## 実装チェックリスト

- [ ] ui-authパッケージ依存の追加
- [ ] Cache APIラッパーの実装
- [ ] BFF連携機能の実装
- [ ] CORS Proxy連携機能の実装
- [ ] 認証フローの統合
- [ ] エラーハンドリングの強化
- [ ] パフォーマンス測定の実装
- [ ] セキュリティテストの実施