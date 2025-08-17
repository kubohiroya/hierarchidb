# 5. アーキテクチャ概要

本章では、hierarchidb の全体アーキテクチャとモジュール構成、依存関係を俯瞰する。章末には詳細編（5.1〜5.4）への導線を示す。

- サーバサイドは Cloudflare Workers 上で稼働（bff, cors-proxy）。
- クライアントサイドは GitHub Pages（静的ホスティング）で提供され、UI と Worker（ブラウザ内のアプリ内ワーカー/Comlink）が疎結合に連携する。

## 5.1 モジュール一覧と依存関係（概要）

- サーバサイド
  - bff: OAuth2 認証仲介（Google/Microsoft/GitHub）。Cloudflare Worker。
  - cors-proxy: 外部オープンデータ/API への CORS 制約回避プロキシ（bff 認証必須）。
- クライアントサイド
  - core: アプリ共通の型・定数・ユーティリティ（データモデル、DBスキーマの型など）。
  - api: UI 層と Worker 層の通信契約（Comlink インターフェイス）。
  - worker: DB 操作、コマンド処理、Pub/Sub 通知などバックエンド的役割。
  - ui-* 群: UI を機能ごとに分割（ui-core/ui-auth/ui-routing/ui-i18n/ui-client/ui-layout/ui-navigation/ui-file/ui-monitoring/ui-tour）。
  - app: ルートエントリ。UI と各モジュールの初期化と結線。

依存方向（論理）：
```
ui-client → api → core
ui-auth, ui-routing, ui-navigation, ui-layout, ui-file → ui-core
worker → core
app → (ui-client, ui-core, ui-auth, ui-routing, ui-i18n, ui-layout, ui-navigation, ui-file, ui-monitoring, ui-tour, worker, core)
ui-i18n → (独立)
```

### 5.1.1 依存関係の図示（概念図）

```
+-----------------------+        +---------------------+
|   Cloudflare Workers  |        |     GitHub Pages    |
|  (Server-side)        |        |   (Client-side)     |
+-----------------------+        +---------------------+
|  bff      cors-proxy  |        |  app                |
+----^------------^-----+        |   |                 |
     |            |              |   v                 |
     |   OAuth2 / API 認証      |  ui-* modules       |
     |                           |  (ui-core, auth,   |
     |                           |   routing, i18n,   |
     |                           |   client, layout,  |
     |                           |   navigation, file,|
     |                           |   monitoring, tour)|
     |                           |   |                 |
     |                           |   v                 |
     |                           |  api  →  worker    |
     |                           |    \       ^       |
     |                           |     \      |       |
     |                           |      \   Comlink   |
     |                           |       \    |       |
     |                           |        v   |       |
     |                           |       core |       |
     |                           |            |       |
     +---------------------------+------------+-------+
```

- UI は ui-client を介して api を呼び出し、Comlink で worker に委譲。worker は core の型・規約を用いて DB を更新・購読通知を行う。
- サーバサイド（bff/cors-proxy）は必要時のみ介在し、クライアント内のアーキテクチャからは分離。

## 5.2 UI ガイドライン（抜粋と拡張）

設計方針（4.6 からの要点統合 + 追記）
- 制御/非制御を混在させない。フォームは react-hook-form 等で統一。
- アクセシビリティ（ラベル/ロール/キーボード操作）を確保。
- 大量行は仮想化必須（Virtualizer）。
- CSS-in-JS は最小限。テーマトークンを優先し直値を避ける。
- UI は機能別パッケージに分割し、必要機能のみ取り込むことでバンドル最適化。

UI モジュールの分割（概要）
- @hierarchidb/ui-core: 基本 UI、MUI、テーマ、通知。
- @hierarchidb/ui-auth: 認証 UI とフック。
- @hierarchidb/ui-routing: ルーティングとナビゲーション補助。
- @hierarchidb/ui-i18n: 国際化（i18next 設定と言語切替）。
- @hierarchidb/ui-client: Worker/API 接続、フック群。
- @hierarchidb/ui-layout, ui-navigation, ui-file, ui-monitoring, ui-tour: レイアウト/動線/ファイル/監視/ガイドを分離提供。

詳細は 5.4-UI 章を参照。

## 5.3 データ・フロー要約

- Query/Mutation: UI → api（Comlink）→ worker → IndexedDB（CoreDB/EphemeralDB）。
- Pub/Sub: UI は特定ノード配下の部分木を subscribe し、差分を受信。
- 一貫性: 兄弟名ユニーク、参照整合性、クロスツリー禁止、保存時正規化。

## 5.4 章構成（詳細編への導線）

- 5.1-serverside.md: Cloudflare Workers（bff/cors-proxy）、設定値管理、セキュリティ方針。
- 5.2-core.md: コアデータモデル、命名規約、DB スキーマ型とマイグレーション方針。
- 5.3-api-worker.md: API 契約、Worker 責務、Pub/Sub、コマンドモデル、DB 設計（実装視点）。
- 5.4-ui.md: UI モジュール詳細、フック/コンポーネント一覧、アプリ結線、i18n/アクセシビリティ指針。

補足: サーバサイドの認証クレデンシャルは Cloudflare Secrets（`wrangler secret put`）、非機密は `.env`（.gitignore 登録）で管理する。