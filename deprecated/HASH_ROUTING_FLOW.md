# Hash Routing Flow Documentation

## 概要
HierarchiDBアプリケーションのハッシュルーティング対応について、有効化・無効化それぞれの場合の動作フローを説明します。

## 設定

### 環境変数
- `VITE_USE_HASH_ROUTING`: ハッシュルーティングの有効/無効を制御
  - `'true'` または未設定: ハッシュルーティング有効（デフォルト）
  - `'false'`: ハッシュルーティング無効（ブラウザルーティング）
- `VITE_APP_NAME`: アプリケーションのベースパス（例: 'hierarchidb'）

## ケース1: ハッシュルーティング有効（VITE_USE_HASH_ROUTING !== 'false'）

### ビルド時の動作

```mermaid
graph TD
    A[pnpm run build] --> B[react-router build]
    B --> C[fix-spa-build.js実行]
    C --> D[Hash routing有効判定]
    D --> E[専用index.html生成]
    E --> F[404.html生成をスキップ]
    
    E --> E1[ハッシュリダイレクトスクリプト追加]
    E --> E2[React Router SPA初期化]
    E --> E3[ルートモジュールの静的インポート]
```

### 生成されるindex.html構造

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <script type="text/javascript">
        // 1. Hash routing handler (初回のみ実行)
        // パスベースURL → ハッシュベースURLにリダイレクト
    </script>
</head>
<body>
    <div id="root"></div>
    <script>
        // 2. React Router SPA初期化
        window.__reactRouterContext = { 
            basename: "/hierarchidb/",
            isSpaMode: true
        };
    </script>
    <script type="module">
        // 3. 静的モジュールインポート
        import "/hierarchidb/assets/manifest-xxx.js";
        import * as route0 from "/hierarchidb/assets/root.js";
        import * as indexRoute from "/hierarchidb/assets/_index.js";
        
        window.__reactRouterRouteModules = {
            "root": route0,
            "routes/_index": indexRoute
        };
    </script>
</body>
</html>
```

### 実行時の動作フロー

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant GH as GitHub Pages
    participant RR as React Router

    Note over U,RR: Case 1a: 直接アクセス (https://example.github.io/hierarchidb/)
    U->>B: https://example.github.io/hierarchidb/
    B->>GH: GET /hierarchidb/
    GH-->>B: index.html
    B->>B: hashRoutingスクリプト実行
    Note over B: sessionStorage確認→未処理のためマーク
    Note over B: path === base+'/' なので処理なし
    B->>RR: React Router初期化
    RR-->>U: アプリ表示

    Note over U,RR: Case 1b: サブパスアクセス (https://example.github.io/hierarchidb/some/path)
    U->>B: https://example.github.io/hierarchidb/some/path
    B->>GH: GET /hierarchidb/some/path
    GH-->>B: index.html (フォールバック)
    B->>B: hashRoutingスクリプト実行
    Note over B: path startsWith base+'/' && !hash
    B->>B: sessionStorage設定
    B->>B: window.location.replace("/hierarchidb/#/some/path")
    B->>GH: GET /hierarchidb/ (ハッシュ付き)
    GH-->>B: index.html
    B->>B: hashRoutingスクリプト実行
    Note over B: sessionStorage確認済み→処理スキップ
    B->>RR: React Router初期化（ハッシュパス解釈）
    RR-->>U: アプリ表示
```

## ケース2: ハッシュルーティング無効（VITE_USE_HASH_ROUTING === 'false'）

### ビルド時の動作

```mermaid
graph TD
    A[pnpm run build] --> B[react-router build]
    B --> C[fix-spa-build.js実行]
    C --> D[Hash routing無効判定]
    D --> E[標準index.html生成]
    D --> F[404.html生成]
    
    E --> E1[GitHub Pages SPA対応スクリプト追加]
    E --> E2[React Router SPA初期化]
    E --> E3[ルートモジュールの静的インポート]
    
    F --> F1[404→index リダイレクトスクリプト]
```

### 実行時の動作フロー

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant GH as GitHub Pages
    participant RR as React Router

    Note over U,RR: Case 2a: ルートアクセス
    U->>B: https://example.github.io/hierarchidb/
    B->>GH: GET /hierarchidb/
    GH-->>B: index.html
    B->>RR: React Router初期化
    RR-->>U: アプリ表示

    Note over U,RR: Case 2b: サブパスアクセス（存在しないルート）
    U->>B: https://example.github.io/hierarchidb/some/path
    B->>GH: GET /hierarchidb/some/path
    GH-->>B: 404.html
    B->>B: 404リダイレクトスクリプト実行
    B->>GH: GET /hierarchidb/?/some/path
    GH-->>B: index.html
    B->>B: SPA復元スクリプト実行
    Note over B: /?/some/path → /some/path復元
    B->>RR: React Router初期化
    RR-->>U: アプリ表示
```

## 現在の問題点と解決策

### 問題: アセットファイルアクセス時の404.html実行

```mermaid
sequenceDiagram
    participant B as Browser
    participant GH as GitHub Pages
    
    Note over B,GH: 現在の問題フロー
    B->>GH: GET /hierarchidb/assets/_index.js
    GH-->>B: 404.html（ファイルが見つからない）
    B->>B: 404スクリプト実行
    B->>GH: GET /hierarchidb/?/assets/_index.js
    GH-->>B: index.html（間違ったリダイレクト）
    Note over B: アセット読み込み失敗
```

### 解決策

1. **404.htmlを削除**: ハッシュルーティングでは不要
2. **アセットパスの検証**: fix-spa-build.jsでアセットファイル存在確認
3. **ビルド後検証**: 必要なアセットファイルが正しく生成されているか確認

## 設定変更手順

### ハッシュルーティング有効化
```bash
# .env.production
VITE_USE_HASH_ROUTING=true  # または未設定
```

### ハッシュルーティング無効化
```bash
# .env.production
VITE_USE_HASH_ROUTING=false
```

### ビルド・デプロイ
```bash
pnpm run build  # 設定に応じたindex.html/404.html生成
```

## トラブルシューティング

### ハッシュルーティング有効時のチェック項目
- [ ] 404.htmlが生成されていない
- [ ] index.htmlにハッシュリダイレクトスクリプトが含まれている  
- [ ] 必要なアセットファイル（manifest-*.js, _index.js等）が存在する
- [ ] React Router contextの設定が正しい

### ハッシュルーティング無効時のチェック項目  
- [ ] 404.htmlが生成されている
- [ ] 404.htmlにSPAリダイレクトスクリプトが含まれている
- [ ] index.htmlにSPA復元スクリプトが含まれている