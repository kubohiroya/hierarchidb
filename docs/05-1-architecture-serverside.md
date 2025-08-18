## 5.1 サーバサイド（Cloudflare Workers）

本章では、Cloudflare 上で稼働するサーバサイドモジュール（bff, cors-proxy）の役割、API 境界、設定値管理、セキュリティ指針をまとめる。

[現状ステータス]
- 本リポジトリ内に Cloudflare Workers（bff, cors-proxy）の実装が含まれる（packages/bff, packages/cors-proxy）。
- 両者は Hono + jose で実装され、wrangler によるローカル開発/デプロイスクリプトを同梱（各 package.json の dev/deploy スクリプト参照）。
- クライアントサイド（Vite + React）およびブラウザ内 Worker（Comlink）は実装済み。UI は `@hierarchidb/ui-client` を介して `@hierarchidb/worker` に接続し、認証や外部APIアクセス時に bff/cors-proxy を利用する。

### 5.1.1 BFF / CORS-Proxy / Client

サーバサイドは BFF と CORS-Proxy の2要素で構成され、クライアント（UI/Worker）と外部サービスの間にセキュアな境界を形成する。役割分担は次のとおり。

- BFF: OAuth2 認証仲介（Google/Microsoft/GitHub）。機密情報やトークンの安全な授受、短期セッションの発行/検証を担う。
- CORS-Proxy: 外部オープンデータ/API への CORS 制約回避プロキシ（BFF 認証必須）。許可リストに基づいた安全な転送を提供。

基本フロー（例1：OAuth2 認証）
1) UI が BFF の `/auth/{provider}/authorize` にリダイレクト/起動
2) 認可サーバで認証完了→ BFF に `callback` 到達
3) BFF がトークン交換・セッション発行を実施
4) UI は発行済みセッションで後続 API（CORS-Proxy 等）を利用

基本フロー（例2：外部 API の CORS 代理取得）
1) UI/Worker が BFF 認証後のトークンを付与して CORS-Proxy にリクエスト
2) CORS-Proxy がトークン検証・転送先の許可確認
3) 外部 API に代理リクエスト送信
4) CORS 設定を付与したレスポンスを UI に返却

### 5.1.2 bff（Backends For Frontends）

[現状]
- 実装済み。Cloudflare Workers 向けに Hono ベースで実装され、OAuth2 認証およびセッション発行/検証/更新/失効を提供（packages/bff）。
- 主要エンドポイント例: `/auth/{provider}/authorize`（GET/POST）, `/auth/callback`（GET）, `/auth/token`（POST）, `/auth/refresh`（POST）, `/auth/revoke`（POST）, `/.well-known/openid-configuration`（GET）。
- 設定値: GOOGLE/GITHUB/MICROSOFT 各 CLIENT_ID/SECRET, JWT_SECRET, JWT_ISSUER, SESSION_DURATION_HOURS, ALLOWED_ORIGINS, REDIRECT_URI 等。`BFF_` プレフィックスの環境変数は実行時に非プレフィックス名へマップ（env-mapper 参照）。
/call
#### 目的（方針）
- クライアント（UI層）と外部APIサービス（Google/Microsoft/GitHub）間のOAuth2認証を仲介。
- UI 側に機密を持たせず、BFF経由でのみ外部APIにアクセス。
- 認証状態は短期セッション化し安全に返却（返却手段は後述の設計検討）。

#### 機能要件（方針）
- OAuth2 認証フローの開始/コールバックハンドリング。
- アクセストークン・リフレッシュトークンの安全な管理（Cloudflare KV/Secrets）。
- 認証済みユーザのセッション発行（短期トークン）。
- 認証済みセッションの発行と検証 API。

#### 実装上のポイント（現時点の指針）
- 認証結果の返却手段は次のいずれかを採用（実装時に最終決定）：
  - HTTP-only クッキー（XSS耐性が高い）。
  - フロントにリダイレクト後、POST メッセージ/URL フラグメントで一時コードを返し、BFF でトークン交換（Cookie 不使用構成）。
- 認証フローは外部リダイレクトを伴うため、state パラメータで CSRF 防止。
- Cloudflare Worker として実装し、低レイテンシ動作。
- 設定値管理方針（暫定）
  - フロントエンドのビルド時変数は Vite の `import.meta.env`（`VITE_` プレフィックス）で管理。
  - BFF のクライアントID・リダイレクトURLなど非機密は wrangler の vars もしくは環境変数で管理。
  - シークレット（クライアントシークレット/署名鍵など）は `wrangler secret put` で登録し、コードから参照。
  - `.env` はフロント用とサーバ用を分離し、誤コミット防止のため `.gitignore` を厳守。

### 5.1.3 cors-proxy

[現状]
- 実装済み。Cloudflare Workers 向けに Hono + jose で実装され、BFF の JWT もしくは各プロバイダのトークン/JWKS による検証後に、許可リストに基づいて外部 API へ GET 代理リクエストを行う（packages/cors-proxy）。
- 主要エンドポイント例: `GET /?url=<target>`（Authorization: Bearer <token>）。
- 設定値: `ALLOWED_TARGET_LIST`（必須）, `BFF_JWT_SECRET`, `BFF_JWT_ISSUER`, `CLIENT_ID`（Google）, `MICROSOFT_CLIENT_ID`, `GITHUB_CLIENT_ID`, `JWKS_URL`, `TOKEN_ISSUER`, `TOKEN_AUD` 等。`CORS_PROXY_` プレフィックスの環境変数は非プレフィックス名へマップ（env-mapper 参照）。

#### 目的（方針）
- 外部のオープンデータ/APIを利用する際に、CORS制約を回避する。
- 利用時には BFF による認証を必須とし、不正利用を防ぐ。

#### 機能要件（方針）
- 任意 URL への HTTP リクエストを代理送信（メソッド/ヘッダ/ボディ/クエリ透過）。
- レスポンスに適切な `Access-Control-Allow-Origin` を付与。
- 事前許可リスト（ホワイトリスト）による転送先制限。

#### 実装上のポイント（方針）
- 大容量レスポンス/ストリーミングは対象外（リソース保護）。
- キャッシュ制御で重複取得を最適化。
- 転送先 URL は事前定義 or 署名付きで制御。

#### 設定値管理方針（暫定）
- 許可リスト URL や CORS 設定値など非機密は wrangler の vars で管理。
- 認証トークンや署名用秘密鍵は Cloudflare Secrets に保存。
