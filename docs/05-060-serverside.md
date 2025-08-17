# 5.1 サーバサイド（Cloudflare Workers）

本章では、Cloudflare 上で稼働するサーバサイドモジュール（bff, cors-proxy）の役割、API 境界、設定値管理、セキュリティ指針をまとめる。

## 5.1.1 概要
- bff: OAuth2 認証仲介（Google/Microsoft/GitHub）。
- cors-proxy: 外部オープンデータ/API への CORS 制約回避プロキシ（bff 認証必須）。

## 5.1.2 bff（Backends For Frontends）
### 目的
- UI と外部 OAuth2/OIDC プロバイダの間で認証を仲介し、UI 側に機密を持たせない。
- 認証状態を短期セッション化し、クッキー（HTTP-only）で安全に返却。

### 機能要件
- OAuth2 認証フロー開始/コールバック処理。
- アクセス/リフレッシュトークン保管（Cloudflare KV/Secrets）。
- 認証済みセッションの発行と検証 API。

### 実装上のポイント
- CSRF 対策として state パラメータを利用。
- HTTP-only クッキーで XSS からトークンを保護。
- Worker で軽量・低レイテンシ運用。

### 設定値管理方針
- 非機密（クライアントID、リダイレクトURL等）: `.env`（リポジトリ直下、.gitignore 対象）。
- 機密（クライアントシークレット、署名鍵等）: Cloudflare Secrets（`wrangler secret put`）。

## 5.1.3 cors-proxy
### 目的
- 外部 API へ間接アクセスし、CORS 制約を回避。bff 認証を必須として不正利用を抑止。

### 機能要件
- 任意 URL への HTTP リクエストを代理送信（メソッド/ヘッダ/ボディ/クエリ透過）。
- レスポンスに適切な `Access-Control-Allow-Origin` を付与。
- 事前許可リスト（ホワイトリスト）による転送先制限。

### 実装上のポイント
- 大容量レスポンス/ストリーミングは対象外（リソース保護）。
- キャッシュ制御で重複取得を最適化。
- 転送先 URL は事前定義 or 署名付きで制御。

### 設定値管理方針
- 非機密（許可リスト URL/CORS 設定）: `.env`。
- 機密（認証トークン/署名鍵）: Cloudflare Secrets。

## 5.1.4 セキュリティ/プライバシ指針
- 最小権限: 必要なスコープのみ要求。
- ログに機微情報を残さない（マスキング/削除）。
- 監査: 依存パッケージは `pnpm audit`。

## 5.1.5 運用
- 認証/プロキシのバージョン管理とロールバック手順を用意。
- 監視: エラー率/レイテンシの計測、閾値でアラート。

関連: 5-architecture.md, 5.3-api-worker.md（クライアントの呼び出し経路）。