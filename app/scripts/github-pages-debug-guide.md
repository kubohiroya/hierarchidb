# GitHub Pages 無限リダイレクトループ デバッグガイド

## 🔍 問題診断手順

### 1. ローカル環境での再現テスト

```bash
# ビルド実行
cd packages/_app
pnpm stage

# GitHub Pages環境をローカルで再現
npx serve stage/client -p 8080
# または
python3 -m http.server 8080 --directory stage/client
```

アクセス: http://localhost:8080/hierarchidb/

### 2. デバッグHTMLでの診断

```bash
# デバッグ用HTMLをビルドディレクトリにコピー
cp scripts/debug-404.html stage/client/debug-404.html
cp scripts/debug-index.html stage/client/debug-index.html
```

テストURL:

- http://localhost:8080/hierarchidb/debug-index.html (正常ケース)
- http://localhost:8080/hierarchidb/debug-404.html (404リダイレクトケース)
- http://localhost:8080/hierarchidb/some/path/debug-404.html (深いパス)

### 3. 問題の切り分けチェックリスト

#### ✅ 基本設定の確認

- [ ] リポジトリ名は `hierarchidb` か？
- [ ] VITE_APP_NAME は `hierarchidb` に設定されているか？
- [ ] ビルド時に production モードか？
- [ ] build/client ディレクトリに 404.html が存在するか？
- [ ] 404.html と index.html の内容が異なるか？

#### ✅ リダイレクトスクリプトの動作確認

- [ ] 404.html の pathSegmentsToKeep は 1 か？
- [ ] index.html のリダイレクト処理スクリプトが存在するか？
- [ ] ブラウザのコンソールにエラーが出ていないか？

#### ✅ GitHub Pages側の設定

- [ ] GitHub Pages のソースは正しく設定されているか？
- [ ] カスタムドメインを使用していないか？
- [ ] リポジトリ設定で base path が正しいか？

### 4. よくある原因と解決策

#### 原因1: pathSegmentsToKeep の値が間違っている

```javascript
// 正しい値の計算方法
// URL: https://username.github.io/hierarchidb/some/path
// username.github.io/ の後のセグメント数 = 1 (hierarchidb)
var pathSegmentsToKeep = 1;
```

#### 原因2: basename と実際のパスの不一致

```javascript
// React Router の basename
basename: "/hierarchidb/"

// 実際のURL
https://username.github.io/hierarchidb/  // ✓ OK
https://username.github.io/HierarchiDB/  // ✗ 大文字小文字の違い
https://username.github.io/hierarchi-services/ // ✗ 名前の違い
```

#### 原因3: リダイレクトループ

```javascript
// 404.html がリダイレクト → index.html
// index.html が再度リダイレクト → 無限ループ

// 解決: index.html で既にリダイレクト済みかチェック
if (l.search[1] === '/') {
  // リダイレクト処理
} else {
  // 通常の処理
}
```

### 5. 代替ソリューション

#### オプション1: HashRouter を使用

```javascript
// React Router を HashRouter に変更
// URL例: https://username.github.io/hierarchidb/#/some/path
// 404.html が不要になる
```

#### オプション2: GitHub Actions でのカスタムビルド

```yaml
# .github/workflows/deploy.yml
- name: Build and Deploy
  run: |
    pnpm build
    # カスタム 404.html 処理
```

#### オプション3: 静的ファイル生成

```javascript
// すべてのルートを事前生成
// React Router の prerender オプションを使用
```

### 6. デバッグ情報の収集

ブラウザのコンソールで以下を実行:

```javascript
console.log({
  href: window.location.href,
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  basename: window.__reactRouterContext?.basename,
  spaMode: window.__reactRouterContext?.isSpaMode
});
```

### 7. 問題報告テンプレート

```markdown
## 環境
- ブラウザ: 
- OS: 
- ビルドコマンド: 
- デプロイ方法: 

## 現象
- アクセスしたURL: 
- リダイレクト先URL: 
- エラーメッセージ: 

## デバッグ情報
- pathSegmentsToKeep: 
- basename: 
- コンソールログ: 
```

## 🚀 推奨アクション

1. **まず debug-404.html と debug-index.html で問題を再現**
2. **コンソールログから原因を特定**
3. **必要に応じて HashRouter への移行を検討**
4. **GitHub Actions での自動デプロイ設定**