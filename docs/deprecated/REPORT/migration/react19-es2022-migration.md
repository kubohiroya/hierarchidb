# React 19 & ES2022 標準化移行ガイド

## 概要
HierarchiDBプロジェクトは、全パッケージでReact 19とTypeScript ES2022ターゲットを標準として採用しました。このドキュメントは、移行の詳細と今後の開発方針を記載します。

## 標準化内容

### React 19
- **バージョン**: 19.1.1
- **適用範囲**: 全UIパッケージ（@hierarchidb/ui-*、プラグイン）
- **peerDependencies**: >=18.0.0（後方互換性維持）

### TypeScript ES2022
- **ターゲット**: ES2022
- **モジュール**: ESNext
- **適用範囲**: 全パッケージ

## パッケージ設定標準

### package.json
```json
{
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

### tsconfig.json（最小構成）
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.test.tsx"]
}
```

### tsup.config.ts
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  target: 'es2022',  // ES2022ターゲット必須
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // その他の設定...
});
```

## 移行チェックリスト

### 1. React 19への移行
- [ ] package.jsonのreact/react-domを19.1.1に更新
- [ ] peerDependenciesを>=18.0.0に設定
- [ ] React 19の新機能（use()フックなど）の活用検討

### 2. ES2022設定
- [ ] tsup.config.tsにtarget: 'es2022'を追加
- [ ] tsconfig.jsonの冗長な設定を削除
- [ ] ES2022の新機能（Top-level await、Array.at()など）の活用

### 3. 設定の最小化
- [ ] tsconfig.jsonから基底クラスと重複する設定を削除
- [ ] package.jsonの不要なフィールドを削除
- [ ] 各パッケージ固有の設定のみを残す

## ES2022で利用可能になる機能

### 主要な新機能
- **Top-level await**: モジュールのトップレベルでawaitが使用可能
- **Array.at()**: 負のインデックスでの配列アクセス
- **Object.hasOwn()**: Object.prototype.hasOwnPropertyの安全な代替
- **Error.cause**: エラーチェーンの改善
- **RegExp match indices**: 正規表現マッチの位置情報取得
- **Private fields**: クラスのプライベートフィールド（#prefix）

### 使用例
```typescript
// Top-level await
const config = await loadConfig();

// Array.at()
const lastItem = array.at(-1);

// Object.hasOwn()
if (Object.hasOwn(obj, 'property')) {
  // 安全なプロパティチェック
}

// Error.cause
throw new Error('Failed to process', { cause: originalError });

// Private fields
class MyClass {
  #privateField = 42;
  
  getPrivate() {
    return this.#privateField;
  }
}
```

## 注意事項

### React 19の破壊的変更
- `defaultProps`は非推奨（デフォルトパラメータを使用）
- `propTypes`は削除（TypeScriptを使用）
- 一部のライフサイクルメソッドが非推奨

### TypeScript設定
- `composite: true`のパッケージでは`allowImportingTsExtensions: false`必須
- インクリメンタルビルドのため`incremental: true`推奨
- `noEmit: false`（tsupでビルドするため）

## トラブルシューティング

### ビルドエラー
```bash
# 依存関係の再インストール
pnpm install

# キャッシュクリア
pnpm build --force

# 型チェック
pnpm typecheck
```

### React 19互換性問題
- サードパーティライブラリがReact 18以下を要求する場合
  - peerDependenciesの`>=18.0.0`により互換性維持
  - 必要に応じてオーバーライド設定を追加

### ES2022サポート
- 古いブラウザサポートが必要な場合
  - Viteのポリフィル設定を調整
  - 必要最小限のトランスパイルを設定

## 今後の方針

1. **新規パッケージ**: 必ずReact 19とES2022を基準とする
2. **既存パッケージ**: 段階的に最新機能を活用
3. **ドキュメント**: 新機能の使用例を追加
4. **テスト**: React 19の新機能をテストでカバー

## 関連ドキュメント
- [開発環境](../05-dev-environment.md)
- [開発ガイドライン](../05-dev-guidelines.md)
- [パッケージエクスポートガイドライン](../package-export-guidelines.md)