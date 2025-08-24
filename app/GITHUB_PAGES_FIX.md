# GitHub Pages 無限リダイレクトループ 解決手順

## 📋 即座に試すべき診断手順

### ステップ1: ローカルでの問題再現

```bash
# 1. クリーンビルド
cd packages/_app
rm -rf build
pnpm build

# 2. デバッグファイルをコピー
pnpm debug:copy

# 3. ローカルサーバーで確認
pnpm debug:serve
```

### ステップ2: ブラウザでテスト

以下のURLにアクセスして動作を確認:

1. **最小テスト**: http://localhost:8080/hierarchidb/minimal-test.html
2. **404デバッグ**: http://localhost:8080/hierarchidb/debug-404.html
3. **Indexデバッグ**: http://localhost:8080/hierarchidb/debug-index.html
4. **実際のアプリ**: http://localhost:8080/hierarchidb/

### ステップ3: コンソールログ確認

ブラウザの開発者ツールを開き、以下を確認:

```javascript
// コンソールで実行
console.table({
  'Current URL': window.location.href,
  'Pathname': window.location.pathname,
  'Search': window.location.search,
  'Expected Base': '/hierarchidb/',
  'Has Redirect Query': window.location.search && window.location.search[1] === '/'
});
```

## 🔧 よくある問題と即効性のある解決策

### 解決策1: pathSegmentsToKeep の修正

`scripts/fix-spa-build.js` の404.html生成部分を確認:

```javascript
// GitHubユーザー名が kubohiroya の場合
// URL: https://kubohiroya.github.io/hierarchidb/
var pathSegmentsToKeep = 1; // 正しい

// カスタムドメインの場合
// URL: https://example.com/
var pathSegmentsToKeep = 0; // カスタムドメイン用
```

### 解決策2: スラッシュの扱いを修正

index.htmlのリダイレクト処理を修正:

```javascript
// 修正前
if (l.search[1] === '/' ) {

// 修正後（より堅牢）
if (l.search && l.search.indexOf('/?/') === 0) {
```

### 解決策3: HashRouterへの移行（最も確実）

`src/entry.client.tsx` を修正:

```typescript
import { createHashRouter } from 'react-router-dom';

// BrowserRouter の代わりに HashRouter を使用
const router = createHashRouter(routes, {
  // basename は不要
});
```

## 🚨 緊急対応

### 今すぐ動作させたい場合

1. **一時的な回避策** - 404.htmlを削除
```bash
rm build/client/404.html
# SPAルーティングは動作しないが、ホームページは表示される
```

2. **HashRouterへの即時切り替え**
```bash
# ブランチを作成
git checkout -b fix/hash-router

# HashRouter実装（後述のコード参照）
# ビルド & デプロイ
pnpm build
pnpm deploy
```

## 📝 問題の根本原因チェックリスト

- [ ] リポジトリ名とVITE_APP_NAMEが完全一致している
- [ ] 大文字小文字が正確に一致している
- [ ] build/client/404.html が存在する
- [ ] 404.htmlとindex.htmlの内容が異なる
- [ ] GitHub Pages設定でカスタムドメインを使用していない
- [ ] ブラウザのキャッシュをクリアした
- [ ] シークレットウィンドウでテストした

## 💡 推奨される恒久的解決策

### オプションA: HashRouter実装（最も簡単）

```typescript
// packages/_app/src/entry.client.tsx
import { createHashRouter, RouterProvider } from 'react-router-dom';

const router = createHashRouter(routes);
// URLは /hierarchidb/#/path/to/page 形式になる
// 404.htmlは不要
```

### オプションB: GitHub Actions自動デプロイ

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - name: Fix 404
        run: |
          cp packages/app/build/client/index.html packages/app/build/client/404.html
          # カスタム404処理
      - uses: peaceiris/actions-gh-pages@v3
```

## 📞 サポート

問題が解決しない場合:

1. `scripts/github-pages-debug-guide.md` の詳細ガイドを参照
2. デバッグログを収集して issue を作成
3. HashRouter への移行を検討