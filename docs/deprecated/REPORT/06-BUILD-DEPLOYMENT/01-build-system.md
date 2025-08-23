# 6.1 ビルドシステム

## ビルド構成

### モノレポ構成
```
hierarchidb/
├── packages/
│   ├── core/        # 型定義のみ
│   ├── api/         # インターフェース
│   ├── worker/      # Worker実装
│   ├── app/         # メインアプリ
│   └── plugins/     # プラグイン群
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### ビルドツール選定

| レイヤー | ツール | 理由 |
|---------|--------|------|
| ライブラリ | tsup | ESM/CJS両対応、高速 |
| アプリケーション | Vite | HMR、最適化 |
| 型チェック | tsc | TypeScript公式 |
| バンドル最適化 | Rollup (Vite内部) | Tree Shaking |

## tsup設定

### 基本設定
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,              // 型定義生成
  splitting: true,        // コード分割
  sourcemap: true,        // ソースマップ
  clean: true,            // ビルド前クリーン
  target: 'es2022',       // ターゲット
  external: ['react'],    // 外部依存
});
```

### パッケージ別設定

#### coreパッケージ（型のみ）
```typescript
// packages/core/tsup.config.ts
export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: {
    only: true  // 型定義のみ生成
  },
});
```

#### workerパッケージ
```typescript
// packages/worker/tsup.config.ts
export default defineConfig([
  {
    entry: ['src/openstreetmap-type.ts'],
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
  },
  {
    entry: ['src/worker.ts'],
    format: ['iife'],
    platform: 'browser',
    // Worker用の特別な設定
  }
]);
```

## Vite設定

### アプリケーション設定
```typescript
// packages/app/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reactRouter } from '@react-router/dev/vite';

export default defineConfig({
  plugins: [
    react(),
    reactRouter(),
  ],
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mui': ['@mui/material'],
          'vendor-map': ['maplibre-gl'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
```

### 環境変数
```typescript
// 環境別設定
const env = loadEnv(mode, process.cwd());

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME),
    'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
  },
  base: env.VITE_APP_NAME ? `/${env.VITE_APP_NAME}/` : '/',
});
```

## Turborepo設定

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

### 並列ビルド最適化
```bash
# 依存関係を考慮した並列ビルド
turbo run build

# キャッシュ統計
turbo run build --dry-run

# 特定パッケージのみ
turbo run build --filter=@hierarchidb/worker
```

## パッケージエクスポート設定

### package.json exports
```json
{
  "name": "@hierarchidb/worker",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./worker": {
      "types": "./dist/worker.d.ts",
      "import": "./dist/worker.js"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

### TypeScript paths設定
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "@hierarchidb/core": ["../core/src"],
      "@hierarchidb/api": ["../api/src"]
    }
  }
}
```

## ビルド最適化

### Tree Shaking
```typescript
// sideEffects設定
{
  "sideEffects": false,  // 副作用なし宣言
  // または特定ファイルのみ
  "sideEffects": ["*.css", "*.scss"]
}
```

### コード分割
```typescript
// 動的インポート
const BaseMapPlugin = () => import('./plugins/basemap');
const SpreadsheetPlugin = () => import('./plugins/spreadsheet');

// React.lazy
const LazyComponent = lazy(() => 
  import('./components/HeavyComponent')
);
```

### バンドルサイズ分析
```bash
# Bundle Analyzer
pnpm add -D rollup-plugin-visualizer

# vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({
    open: true,
    gzipSize: true,
    brotliSize: true,
  })
]
```

## ビルドスクリプト

### package.json scripts
```json
{
  "scripts": {
    "build": "turbo run build",
    "build:packages": "turbo run build --filter='./packages/*'",
    "build:plugins": "turbo run build --filter='./packages/plugins/*'",
    "build:app": "turbo run build --filter=@hierarchidb/app",
    "build:force": "turbo run build --force",
    "build:analyze": "ANALYZE=true pnpm build:app",
    "prebuild": "pnpm clean",
    "postbuild": "pnpm size"
  }
}
```

### CI/CD用ビルド
```yaml
# .github/workflows/build.yml
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: packages/app/dist
```

## ビルドエラー対処

### よくあるエラー

#### 1. 型定義の欠落
```bash
Error: Cannot find module '@hierarchidb/core' or its corresponding type declarations
```
**解決策**: 
```bash
# 型定義の再生成
pnpm --filter @hierarchidb/core build
```

#### 2. ESM/CJS互換性
```bash
Error: Cannot use import statement outside a module
```
**解決策**:
```json
// package.json
"type": "module"
```

#### 3. パス解決エラー
```bash
Error: Failed to resolve '~/*'
```
**解決策**:
```bash
# tsc-aliasの使用
pnpm add -D tsc-alias
```

## ビルドパフォーマンス

### 測定結果
| 操作 | 時間 | キャッシュあり |
|------|------|---------------|
| 全体ビルド | 45s | 8s |
| 型チェック | 22s | 5s |
| アプリビルド | 18s | 3s |
| プラグインビルド | 12s | 2s |

### 最適化Tips
1. **Turborepoキャッシュ活用**
2. **並列ビルド数の調整**: `--concurrency=4`
3. **不要な依存関係の削除**
4. **型チェックの分離**: `tsc --noEmit`

## バージョニング

### Changesets使用
```bash
# 変更の記録
pnpm changeset

# バージョン更新
pnpm changeset version

# パッケージ公開
pnpm changeset publish
```

### セマンティックバージョニング
```
Major.Minor.Patch
1.0.0 - 破壊的変更
0.1.0 - 新機能
0.0.1 - バグ修正
```