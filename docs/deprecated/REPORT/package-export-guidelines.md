# Package Export Configuration Guidelines

## 問題の背景

このプロジェクトでは、tsupを使用してTypeScriptパッケージをビルドしています。しかし、package.jsonのexport設定とtsupが実際に出力するファイル名の不一致により、ビルドエラーが発生することがあります。

## tsup出力パターン

### パターン1: デフォルト設定（推奨）

```javascript
// tsup.config.ts
export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // outExtensionは指定しない
});
```

**出力ファイル:**
- ESM: `dist/index.js`
- CommonJS: `dist/index.cjs`
- 型定義: `dist/index.d.ts`

**対応するpackage.json:**
```json
{
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

### パターン2: カスタム拡張子（特殊ケース）

```javascript
// tsup.config.ts
export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.cjs'
  })
});
```

**出力ファイル:**
- ESM: `dist/index.mjs`
- CommonJS: `dist/index.cjs`
- 型定義: `dist/index.d.ts`

**対応するpackage.json:**
```json
{
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

## よくある間違い

### ❌ 間違い1: 存在しないファイルを参照

```json
// tsupがデフォルトで.jsを出力しているのに.mjsを参照
{
  "module": "dist/index.mjs",  // ❌ ファイルが存在しない
  "exports": {
    ".": {
      "import": "./dist/index.mjs"  // ❌ ファイルが存在しない
    }
  }
}
```

### ❌ 間違い2: mainとrequireの不一致

```json
{
  "main": "dist/index.js",  // ❌ CommonJSには.cjsを使うべき
  "exports": {
    ".": {
      "require": "./dist/index.cjs"  // mainと不一致
    }
  }
}
```

## 検証と修正

### 1. 手動検証

```bash
# distディレクトリの内容を確認
ls -la packages/your-package/dist/

# index.で始まるファイルを確認（.mapや.d.tsを除く）
ls packages/your-package/dist/index.* | grep -v ".map" | grep -v ".d."
```

### 2. 自動検証スクリプト

```bash
# すべてのパッケージを検証
node scripts/validate-package-exports.cjs

# 問題があるパッケージを自動修正
node scripts/fix-all-package-exports.cjs
```

## 新しいパッケージを作成する際のチェックリスト

1. **tsup.config.tsを作成**
   - デフォルト設定を使用（特別な理由がない限り）
   - `outExtension`は使用しない

2. **ビルドを実行**
   ```bash
   pnpm build
   ```

3. **dist内容を確認**
   ```bash
   ls dist/
   ```

4. **package.jsonを設定**
   - 実際の出力ファイルに合わせて設定
   - 検証スクリプトを実行

5. **依存関係で使用できることを確認**
   ```bash
   # 別のパッケージから依存関係として追加
   pnpm add @hierarchidb/your-new-package@workspace:*
   ```

## トラブルシューティング

### エラー: Failed to resolve entry for package

このエラーは、package.jsonで指定されたファイルが実際に存在しない場合に発生します。

**解決方法:**
1. `ls dist/`で実際のファイルを確認
2. package.jsonのexports設定を修正
3. 検証スクリプトを実行

### エラー: Cannot find module

依存パッケージが正しくビルドされていない可能性があります。

**解決方法:**
1. 依存パッケージをビルド: `pnpm --filter @hierarchidb/dependency build`
2. 全体をビルド: `pnpm build`
3. node_modulesを再インストール: `pnpm install --force`

## ベストプラクティス

1. **一貫性を保つ**: プロジェクト全体で同じパターンを使用
2. **デフォルトを使用**: 特別な理由がない限りtsupのデフォルト設定を使用
3. **検証を自動化**: CIでvalidate-package-exports.cjsを実行
4. **ドキュメント化**: 特殊な設定を使用する場合は理由を記録

## 参考資料

- [tsup Documentation](https://tsup.egoist.dev/)
- [Node.js Package Entry Points](https://nodejs.org/api/packages.html#package-entry-points)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)