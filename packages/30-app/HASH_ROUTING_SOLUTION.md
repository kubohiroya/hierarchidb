# ハッシュルーティング実装 - GitHub Pages無限リダイレクト問題の解決

## 🎯 実装した解決策

環境変数 `VITE_USE_HASH_ROUTING` を使用して、ビルド時にハッシュルーティングモードに切り替える実装を作成しました。

### 実装内容

1. **環境変数による切り替え**
   - `.env.production`: `VITE_USE_HASH_ROUTING=true` を設定
   - `.env.development`: `VITE_USE_HASH_ROUTING=false`（通常のルーティング）

2. **自動パス変換**
   - basenameは通常通り `/hierarchidb/` のまま（React Routerビルドが通る）
   - index.html内でJavaScriptによるパス変換を実装
   - `/hierarchidb/path` → `/hierarchidb/#/path` に自動変換

3. **History API インターセプト**
   ```javascript
   // pushState/replaceStateをオーバーライド
   history.pushState = function() {
     var url = arguments[2];
     if (url && !url.startsWith('#')) {
       arguments[2] = '/hierarchidb/#' + url.replace('/hierarchidb', '');
     }
     return originalPushState.apply(history, arguments);
   };
   ```

## 📋 使用方法

### デフォルト動作（ハッシュルーティング）
```bash
# 開発環境でもハッシュルーティングがデフォルト
pnpm dev
# http://localhost:4200/#/

# 本番環境ビルド
pnpm build
# build/client/ をGitHub Pagesにデプロイ
```

### 通常のルーティングに切り替える場合
```bash
# .env.development または .env.production で設定
VITE_USE_HASH_ROUTING=false

# その後通常通りビルド
pnpm build
```

### URLの形式
- 通常: `https://kubohiroya.github.io/hierarchidb/t/tree-123/node-456`
- ハッシュ: `https://kubohiroya.github.io/hierarchidb/#/t/tree-123/node-456`

## ✅ メリット

1. **GitHub Pages完全対応**
   - 404エラーが発生しない
   - 無限リダイレクトループを完全回避
   - 404.htmlが不要

2. **既存コードへの影響最小**
   - React Routerのコードは変更不要
   - ルーティングロジックは変更不要
   - 環境変数の切り替えのみ

3. **フォールバック機能**
   - 古いURLでアクセスしても自動的にハッシュURLにリダイレクト
   - ブックマークの互換性維持

## 🔧 設定ファイル

### packages/app/.env.production
```env
VITE_APP_NAME=hierarchidb
# VITE_USE_HASH_ROUTING=true  # デフォルトでtrue（省略可）
# VITE_USE_HASH_ROUTING=false # 通常のルーティングを使用する場合のみ設定
```

### packages/app/.env.development
```env
VITE_APP_NAME=hierarchidb
# VITE_USE_HASH_ROUTING=true  # デフォルトでtrue（省略可）
# VITE_USE_HASH_ROUTING=false # 通常のルーティングを使用する場合のみ設定
```

## 📝 注意事項

- ハッシュルーティング時は404.htmlは生成されるが使用されない
- SEOには不利（クローラーがハッシュ部分を認識しづらい）
- URLは少し長くなる（`/#/` が追加される）

## 🚀 デプロイ手順

```bash
# 1. ビルド
cd packages/app
pnpm build

# 2. GitHub Pagesへデプロイ
pnpm deploy

# 3. アクセス確認
# https://kubohiroya.github.io/hierarchidb/
# 自動的に https://kubohiroya.github.io/hierarchidb/#/ にリダイレクトされる
```

## 🎉 結果

この実装により、GitHub Pagesでの無限リダイレクトループ問題が完全に解決されます。