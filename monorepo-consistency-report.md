# モノレポ構成の不整合チェックレポート

## 🔍 チェック結果サマリー

### 1. ❌ React バージョンの不整合

現在、以下の3つのパターンが混在しています：
- React 19.1.1を使用: app, ui系の新しいパッケージ
- React 18.x.xを使用: 古いパッケージ、プラグイン
- 複数バージョン対応: 一部のパッケージで `^18.0.0 || ^19.0.0`

**問題点:**
- バージョンの不整合により、型定義の不一致やランタイムエラーが発生する可能性
- 同じパッケージ内でpeerDependenciesとdevDependenciesが異なるバージョンを指定

### 2. ❌ TypeScript Target設定の不整合

tsconfig.jsonでのtarget設定：
- 15パッケージ: `ES2020`
- 3パッケージ: `esnext`
- 2パッケージ: `ES2022`
- ベース設定: `ES2022`

**問題点:**
- ベース設定が`ES2022`なのに、多くのパッケージが`ES2020`を使用
- ビルドツール（tsup）は`es2022`をターゲットにしているが、TypeScript設定と不一致

### 3. ⚠️ tsconfig.json の冗長な設定

多くのパッケージで以下の設定が重複しています：
```json
{
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true
}
```
これらはすでに`tsconfig.base.json`で定義されています。

### 4. ✅ ビルドツールの統一性

- tsup: UIパッケージとプラグインで統一的に使用
- フォーマット: ESMで統一（良好）
- ターゲット: 一部のみ明示的に`es2022`を指定

### 5. ⚠️ package.json の export フィールド

- 一部のパッケージで`main`と`module`が同じファイルを指定
- tsupのデフォルト出力と不整合の可能性

## 📋 推奨される修正

### 1. React バージョンの統一

**全パッケージのpeerDependencies:**
```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

**appパッケージのdependencies:**
```json
{
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  }
}
```

### 2. TypeScript設定の簡素化

**各パッケージのtsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

### 3. tsup設定の統一

**共通のtsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
```

### 4. package.json の最小化

**type: module のパッケージ:**
```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"]
}
```

## 🎯 アクションアイテム

1. **高優先度:**
   - [ ] React バージョンをpeerDependenciesで統一
   - [ ] TypeScript target設定を統一

2. **中優先度:**
   - [ ] tsconfig.jsonから冗長な設定を削除
   - [ ] tsup.config.tsを統一

3. **低優先度:**
   - [ ] package.jsonのexportsフィールドを整理
   - [ ] 不要なdevDependenciesを削除

## 📊 影響度分析

- **ビルド時間への影響:** TypeScript設定の統一により約10-15%の改善が期待
- **バンドルサイズ:** target設定の統一により、不要なpolyfillを削減可能
- **開発体験:** 設定の簡素化により、新規パッケージ作成が容易に