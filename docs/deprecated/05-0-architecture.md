# 5 アーキテクチャ概要

本章では、hierarchidb の全体アーキテクチャとモジュール構成、依存関係を俯瞰する。
- サーバサイドは Cloudflare Workers 上で稼働（bff, cors-proxy）。本リポジトリには両者の実装が packages 配下に含まれる（デプロイは wrangler を利用）。
- クライアントサイドは静的ホスティング（例: GitHub Pages）で提供され、UI と Worker（ブラウザ内のアプリ内ワーカー/Comlink）が疎結合に連携する。

[現状ステータス]
- 実装済み: core, api（型定義/契約）, worker（IndexedDB, コマンド処理, Pub/Sub）, ui-* 群, app、bff、cors-proxy。
- 配置/運用: bff と cors-proxy は Cloudflare Workers として独立デプロイ（packages/bff, packages/cors-proxy に実装と wrangler スクリプト）。

###  モジュール一覧と依存関係（概要）

- サーバサイド（実装）
  - bff: OAuth2 認証仲介（Google/Microsoft/GitHub）。Cloudflare Worker。
  - cors-proxy: 外部オープンデータ/API への CORS 制約回避プロキシ（bff 認証必須）。
- クライアントサイド（実装）
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

### 依存関係の図示（概念図）

```
+-----------------------+        +---------------------+
|   Cloudflare Workers  |        |     Static Host     |
|  (Server-side, plan)  |        |   (Client-side)     |
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
- サーバサイド（bff/cors-proxy）は必要時のみ介在（クライアント単体でも動作可能だが、認証や外部API利用時はこれらを利用）。


### データ・フロー要約

- Query/Mutation: UI → api（Comlink）→ worker → IndexedDB（CoreDB/EphemeralDB）。
- Pub/Sub: UI は特定ノード配下の部分木を subscribe し、差分を受信。
- 一貫性: 兄弟名ユニーク、参照整合性、クロスツリー禁止、保存時正規化。
