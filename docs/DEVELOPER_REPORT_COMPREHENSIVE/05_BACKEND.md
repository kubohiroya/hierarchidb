# 第5部 バックエンド (Backend)

## Chapter 11: バックエンド・フォー・フロントエンド (Backend for Frontend - BFF)

### 11.1 BFF アーキテクチャ概要 (BFF Architecture Overview)

HierarchiDBのBFFは、Cloudflare Workersを基盤とした軽量なバックエンドサービスです。フロントエンドのニーズに特化した API を提供し、認証とセキュリティを管理します。

```mermaid
graph TB
    subgraph "Frontend"
        ReactApp["React Application"]
        IndexedDB["IndexedDB (Client)"]
    end
    
    subgraph "Edge Network"
        CloudflareWorker["Cloudflare Workers"]
        CORS["CORS Proxy"]
        JWT["JWT Handler"]
    end
    
    subgraph "External Services"
        OAuth["OAuth Providers"]
        GADM["GADM API"]
        NaturalEarth["Natural Earth"]
        GeoBoundaries["GeoBoundaries"]
    end
    
    subgraph "Security Layer"
        Authentication["Authentication Service"]
        TokenValidation["Token Validation"]
        RateLimiting["Rate Limiting"]
    end
    
    ReactApp --> CloudflareWorker
    ReactApp --> CORS
    CloudflareWorker --> JWT
    CloudflareWorker --> Authentication
    Authentication --> OAuth
    CORS --> TokenValidation
    CORS --> RateLimiting
    CloudflareWorker --> GADM
    CloudflareWorker --> NaturalEarth
    CloudflareWorker --> GeoBoundaries
    
    classDef frontend fill:#e1f5fe
    classDef edge fill:#f3e5f5
    classDef external fill:#fff3e0
    classDef security fill:#ffebee
    
    class ReactApp,IndexedDB frontend
    class CloudflareWorker,CORS,JWT edge
    class OAuth,GADM,NaturalEarth,GeoBoundaries external
    class Authentication,TokenValidation,RateLimiting security
```

### 11.2 認証フロー設計 (Authentication Flow Design)

| フェーズ | アクション | 責任主体 | セキュリティ対応 |
|----------|------------|----------|------------------|
| **1. 認証開始** | OAuth リダイレクト | Frontend | state パラメータでCSRF防止 |
| **2. 認証コールバック** | 認可コード受信 | BFF | PKCE による認証強化 |
| **3. トークン交換** | アクセストークン取得 | BFF | client_secret をサーバーで管理 |
| **4. JWT発行** | カスタムJWT生成 | BFF | HS256署名 + 短期有効期限 |
| **5. トークン検証** | API リクエスト認証 | CORS Proxy | JWT署名検証 + 有効期限確認 |

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Frontend as フロントエンド
    participant BFF as BFF (Cloudflare)
    participant OAuth as OAuth Provider
    participant CORS as CORS Proxy
    
    User->>Frontend: ログインクリック
    Frontend->>BFF: /auth/login (state, PKCE)
    BFF->>OAuth: OAuth認証リダイレクト
    OAuth->>User: 認証画面表示
    User->>OAuth: 認証情報入力
    OAuth->>BFF: 認可コード + state
    BFF->>OAuth: トークン交換 (認可コード + client_secret)
    OAuth->>BFF: アクセストークン
    BFF->>BFF: JWT生成 (ユーザー情報 + 有効期限)
    BFF->>Frontend: JWT返却
    Frontend->>CORS: API リクエスト (JWT付き)
    CORS->>CORS: JWT署名検証
    CORS->>Frontend: データ返却
```

### 11.3 セキュリティ実装 (Security Implementation)

```mermaid
graph LR
    subgraph "認証セキュリティ"
        PKCE["PKCE (RFC 7636)"]
        StateParam["State Parameter"]
        CSRFProtection["CSRF Protection"]
    end
    
    subgraph "トークンセキュリティ"
        JWTSigning["JWT Signing (HS256)"]
        ShortExpiry["短期有効期限 (1時間)"]
        SecureStorage["Secure Token Storage"]
    end
    
    subgraph "APIセキュリティ"
        RateLimit["Rate Limiting"]
        IPWhitelist["IP Whitelist"]
        RequestValidation["Request Validation"]
    end
    
    subgraph "データセキュリティ"
        InputSanitization["Input Sanitization"]
        OutputEncoding["Output Encoding"]
        SecretManagement["Secret Management"]
    end
    
    PKCE --> JWTSigning
    StateParam --> ShortExpiry
    CSRFProtection --> SecureStorage
    
    JWTSigning --> RateLimit
    ShortExpiry --> IPWhitelist
    SecureStorage --> RequestValidation
    
    RateLimit --> InputSanitization
    IPWhitelist --> OutputEncoding
    RequestValidation --> SecretManagement
    
    classDef auth fill:#ffebee
    classDef token fill:#f3e5f5
    classDef api fill:#fff3e0
    classDef data fill:#e8f5e9
    
    class PKCE,StateParam,CSRFProtection auth
    class JWTSigning,ShortExpiry,SecureStorage token
    class RateLimit,IPWhitelist,RequestValidation api
    class InputSanitization,OutputEncoding,SecretManagement data
```

## Chapter 12: CORS プロキシサービス (CORS Proxy Service)

### 12.1 CORS プロキシ アーキテクチャ (CORS Proxy Architecture)

```mermaid
graph TB
    subgraph "Frontend Requests"
        ShapePlugin["Shape Plugin"]
        BasemapPlugin["Basemap Plugin"]
        DataImport["Data Import"]
    end
    
    subgraph "CORS Proxy Layer"
        RequestValidator["Request Validator"]
        JWTVerifier["JWT Verifier"]
        URLWhitelist["URL Whitelist"]
        ResponseCache["Response Cache"]
    end
    
    subgraph "External APIs"
        GADMService["GADM Shapefile API"]
        NaturalEarthAPI["Natural Earth API"]
        GeoBoundariesAPI["GeoBoundaries API"]
        OpenStreetMap["OpenStreetMap API"]
    end
    
    subgraph "Security Controls"
        RateLimiter["Rate Limiter"]
        ContentFilter["Content Filter"]
        SizeLimit["Response Size Limit"]
    end
    
    ShapePlugin --> RequestValidator
    BasemapPlugin --> JWTVerifier
    DataImport --> URLWhitelist
    
    RequestValidator --> GADMService
    JWTVerifier --> NaturalEarthAPI
    URLWhitelist --> GeoBoundariesAPI
    ResponseCache --> OpenStreetMap
    
    RequestValidator --> RateLimiter
    JWTVerifier --> ContentFilter
    URLWhitelist --> SizeLimit
    
    classDef frontend fill:#e1f5fe
    classDef proxy fill:#f3e5f5
    classDef external fill:#fff3e0
    classDef security fill:#ffebee
    
    class ShapePlugin,BasemapPlugin,DataImport frontend
    class RequestValidator,JWTVerifier,URLWhitelist,ResponseCache proxy
    class GADMService,NaturalEarthAPI,GeoBoundariesAPI,OpenStreetMap external
    class RateLimiter,ContentFilter,SizeLimit security
```

### 12.2 許可URL管理 (Allowed URL Management)

| カテゴリ | 許可パターン | 用途 | セキュリティレベル |
|----------|--------------|------|-------------------|
| **地理データ** | `https://www.gadm.org/download/*` | 行政境界データ | 高 - JWT必須 |
| **自然地理データ** | `https://www.naturalearthdata.com/*` | 自然地理フィーチャ | 中 - レート制限あり |
| **境界データ** | `https://www.geoboundaries.org/*` | 国境・行政境界 | 高 - JWT必須 |
| **タイルサービス** | `https://{a-c}.tile.openstreetmap.org/*` | ベースマップタイル | 低 - 公開API |
| **統計データ** | `https://api.worldbank.org/*` | 統計・経済データ | 中 - レート制限あり |

### 12.3 レスポンス処理とキャッシング (Response Processing and Caching)

```mermaid
graph LR
    subgraph "Request Processing"
        Incoming["Incoming Request"]
        Validation["Request Validation"]
        CacheCheck["Cache Check"]
    end
    
    subgraph "Cache Strategy"
        MemoryCache["Memory Cache (1MB)"]
        EdgeCache["Edge Cache (10MB)"]
        TTLManagement["TTL Management"]
    end
    
    subgraph "Response Processing"
        SizeValidation["Size Validation (<50MB)"]
        ContentValidation["Content Type Validation"]
        ResponseTransform["Response Transform"]
    end
    
    subgraph "Delivery"
        Compression["Gzip Compression"]
        SecurityHeaders["Security Headers"]
        CORSHeaders["CORS Headers"]
    end
    
    Incoming --> Validation
    Validation --> CacheCheck
    CacheCheck --> MemoryCache
    
    MemoryCache --> EdgeCache
    EdgeCache --> TTLManagement
    TTLManagement --> SizeValidation
    
    SizeValidation --> ContentValidation
    ContentValidation --> ResponseTransform
    ResponseTransform --> Compression
    
    Compression --> SecurityHeaders
    SecurityHeaders --> CORSHeaders
    
    classDef request fill:#e1f5fe
    classDef cache fill:#f3e5f5
    classDef response fill:#fff3e0
    classDef delivery fill:#e8f5e9
    
    class Incoming,Validation,CacheCheck request
    class MemoryCache,EdgeCache,TTLManagement cache
    class SizeValidation,ContentValidation,ResponseTransform response
    class Compression,SecurityHeaders,CORSHeaders delivery
```

## Chapter 13: データプロキシとAPI統合 (Data Proxy and API Integration)

### 13.1 外部API統合戦略 (External API Integration Strategy)

```mermaid
graph TB
    subgraph "Data Source Categories"
        Administrative["行政境界データ"]
        Geographical["地理的フィーチャ"]
        Statistical["統計データ"]
        Realtime["リアルタイムデータ"]
    end
    
    subgraph "Integration Patterns"
        BatchDownload["バッチダウンロード"]
        StreamingAPI["ストリーミングAPI"]
        WebhookAPI["Webhook API"]
        GraphQLAPI["GraphQL API"]
    end
    
    subgraph "Processing Pipeline"
        DataValidation["データ検証"]
        FormatConversion["フォーマット変換"]
        DataEnrichment["データ拡張"]
        QualityControl["品質制御"]
    end
    
    subgraph "Storage Strategy"
        TemporaryCache["一時キャッシュ"]
        PersistentStore["永続ストレージ"]
        MetadataStore["メタデータストア"]
    end
    
    Administrative --> BatchDownload
    Geographical --> StreamingAPI
    Statistical --> WebhookAPI
    Realtime --> GraphQLAPI
    
    BatchDownload --> DataValidation
    StreamingAPI --> FormatConversion
    WebhookAPI --> DataEnrichment
    GraphQLAPI --> QualityControl
    
    DataValidation --> TemporaryCache
    FormatConversion --> PersistentStore
    DataEnrichment --> MetadataStore
    QualityControl --> TemporaryCache
    
    classDef source fill:#e1f5fe
    classDef pattern fill:#f3e5f5
    classDef processing fill:#fff3e0
    classDef storage fill:#e8f5e9
    
    class Administrative,Geographical,Statistical,Realtime source
    class BatchDownload,StreamingAPI,WebhookAPI,GraphQLAPI pattern
    class DataValidation,FormatConversion,DataEnrichment,QualityControl processing
    class TemporaryCache,PersistentStore,MetadataStore storage
```

### 13.2 API エンドポイント設計 (API Endpoint Design)

| エンドポイント | メソッド | 機能 | 認証レベル | レート制限 |
|----------------|----------|------|------------|------------|
| `/auth/login` | POST | OAuth認証開始 | なし | 100/分 |
| `/auth/callback` | GET | OAuth コールバック | なし | 50/分 |
| `/auth/refresh` | POST | トークン更新 | JWT | 200/分 |
| `/proxy/data` | GET | データプロキシ | JWT | 1000/時間 |
| `/proxy/upload` | POST | ファイルアップロード | JWT | 10/分 |
| `/health` | GET | ヘルスチェック | なし | 制限なし |

### 13.3 エラーハンドリングと復旧 (Error Handling and Recovery)

```mermaid
graph LR
    subgraph "Error Detection"
        NetworkError["Network Error"]
        AuthError["Authentication Error"]
        RateLimitError["Rate Limit Error"]
        DataError["Data Format Error"]
    end
    
    subgraph "Recovery Strategies"
        ExponentialBackoff["Exponential Backoff"]
        CircuitBreaker["Circuit Breaker"]
        FallbackCache["Fallback Cache"]
        AlternativeSource["Alternative Source"]
    end
    
    subgraph "Monitoring"
        ErrorLogging["Error Logging"]
        MetricsCollection["Metrics Collection"]
        AlertSystem["Alert System"]
        HealthDashboard["Health Dashboard"]
    end
    
    subgraph "User Experience"
        GracefulDegradation["Graceful Degradation"]
        ProgressIndicator["Progress Indicator"]
        UserNotification["User Notification"]
        RetryMechanism["Retry Mechanism"]
    end
    
    NetworkError --> ExponentialBackoff
    AuthError --> CircuitBreaker
    RateLimitError --> FallbackCache
    DataError --> AlternativeSource
    
    ExponentialBackoff --> ErrorLogging
    CircuitBreaker --> MetricsCollection
    FallbackCache --> AlertSystem
    AlternativeSource --> HealthDashboard
    
    ErrorLogging --> GracefulDegradation
    MetricsCollection --> ProgressIndicator
    AlertSystem --> UserNotification
    HealthDashboard --> RetryMechanism
    
    classDef error fill:#ffebee
    classDef recovery fill:#f3e5f5
    classDef monitoring fill:#fff3e0
    classDef ux fill:#e8f5e9
    
    class NetworkError,AuthError,RateLimitError,DataError error
    class ExponentialBackoff,CircuitBreaker,FallbackCache,AlternativeSource recovery
    class ErrorLogging,MetricsCollection,AlertSystem,HealthDashboard monitoring
    class GracefulDegradation,ProgressIndicator,UserNotification,RetryMechanism ux
```

### 13.4 パフォーマンス最適化 (Performance Optimization)

| 最適化手法 | 目的 | 実装 | 効果指標 |
|------------|------|------|----------|
| **リクエストプーリング** | 同時リクエスト効率化 | Connection Pooling | レスポンス時間 40% 改善 |
| **データ圧縮** | 転送量削減 | Gzip/Brotli圧縮 | 転送量 70% 削減 |
| **キャッシング** | 重複リクエスト削減 | Edge Cache (1時間TTL) | キャッシュヒット率 80% |
| **並列処理** | 大容量データ処理 | Worker Threads | 処理時間 60% 短縮 |
| **プリフェッチ** | 先読み読み込み | Predictive Loading | 体感速度 50% 改善 |

## まとめ (Summary)

バックエンドアーキテクチャでは、軽量で高性能なサービス群を構築しました：

- **BFF**: OAuth認証とJWT管理による安全なユーザー認証
- **CORS Proxy**: 外部API へのセキュアなアクセス制御
- **API統合**: 堅牢なエラーハンドリングとパフォーマンス最適化

この設計により、フロントエンドは安全で高性能な方法で外部リソースにアクセスできます。