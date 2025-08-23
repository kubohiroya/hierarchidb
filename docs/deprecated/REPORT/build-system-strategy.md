# ビルドシステム統一戦略

## はじめに

このビルドシステム統一戦略では、HierarchiDBプロジェクトにおけるビルドツールの統一とビルドプロセスの最適化について説明します。本ドキュメントは以下のような方を対象としています：

**読むべき人**: ビルドエンジニア、DevOps担当者、開発チームリーダー、インフラ担当者、CI/CD最適化を行う方、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインのビルド設定を担当する開発者

**前提知識**: TypeScript、Webpack、Vite、tsup、pnpm、モノレポ管理、CI/CD、Node.js ビルドツール、パッケージ管理

**読むタイミング**: ビルドシステムの改善を計画する際、ビルド速度やCI/CD効率化が必要な際、新規パッケージのビルド設定を行う際に参照してください。特にSpreadsheetプラグインのような新しいパッケージを追加する際は、本戦略に従って統一されたビルド設定を適用することで、保守性と効率性を向上できます。

本戦略は、ビルドツールの統一による開発体験の向上とCI/CDパフォーマンスの最適化を目的としています。

## 現状の問題点

1. **ビルドツールの混在**
   - tsc + tsc-alias
   - tsup
   - React Router build (Vite内部)
   - 各ツールで異なる設定と出力形式

2. **一貫性の欠如**
   - パッケージごとに異なるビルド設定
   - デバッグとトラブルシューティングが困難

## 推奨戦略

### レイヤー別ビルドツール選定

#### 1. ライブラリパッケージ (core, api, worker, ui-*, plugins/*)
**推奨: tsup**

理由:
- TypeScriptライブラリに最適化
- ESM/CJS両対応
- 高速ビルド
- Tree-shakingサポート
- 設定がシンプル

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  }
}
```

tsup.config.ts:
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
});
```

#### 2. アプリケーションパッケージ (app)
**現状維持: React Router + Vite**

理由:
- React Router v7の公式推奨
- SSR/SPA両対応
- HMRとDXが優れている
- ルーティング統合

#### 3. Cloudflare Workers (bff, cors-proxy)
**現状維持: Wrangler**

理由:
- Cloudflare公式ツール
- Workers環境に最適化

### 実装計画

## Phase 1: tsupへの段階的移行 (優先度: 高)

対象パッケージを3グループに分けて移行:

### Group A: 依存関係の少ないパッケージ
- packages/core
- packages/api
- packages/ui-theme
- packages/ui-monitoring

### Group B: UI基盤パッケージ
- packages/ui-core
- packages/ui-auth
- packages/ui-routing
- packages/ui-i18n
- packages/ui-layout
- packages/ui-navigation
- packages/ui-file
- packages/ui-tour

### Group C: プラグインパッケージ
- packages/plugins/folder
- packages/plugins/basemap
- packages/plugins/shapes
- packages/plugins/stylemap

### 既にtsup使用中 (設定の統一のみ)
- packages/ui-treeconsole-*

## Phase 2: Turbo設定の最適化

turbo.json更新:
```json
{
  "tasks": {
    "build:lib": {
      "dependsOn": ["^build:utils"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsup.config.ts", "package.json"]
    },
    "build:app": {
      "dependsOn": ["^build:utils"],
      "outputs": ["build/**", "dist/**"],
      "inputs": ["src/**", "vite.config.ts", "package.json"]
    },
    "build": {
      "dependsOn": ["build:utils", "build:app"]
    }
  }
}
```

## Phase 3: 共通設定の作成

### packages/build-config/tsup.base.ts
```typescript
import { defineConfig } from 'tsup';

export const createTsupConfig = (options = {}) => defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@mui/material', '@emotion/react'],
  ...options,
});
```

各パッケージのtsup.config.ts:
```typescript
import { createTsupConfig } from '@hierarchidb/build-config';

export default createTsupConfig({
  // パッケージ固有の設定
});
```

## 移行手順

### 1. パッケージごとのtsup移行

```bash
# パッケージにtsupを追加
pnpm add -D tsup --filter @hierarchidb/[package-name]

# tsup.config.tsを作成
# package.jsonのscriptsを更新
# ビルドテスト
pnpm build --filter @hierarchidb/[package-name]
```

### 2. 統一されたビルドコマンド

ルートpackage.json:
```json
{
  "scripts": {
    "build": "turbo run build",
    "build:libs": "turbo run build --filter='./packages/*' --filter='!./packages/app'",
    "build:app": "turbo run build --filter=@hierarchidb/app",
    "dev": "turbo run dev --parallel",
    "dev:libs": "turbo run dev --filter='./packages/*' --filter='!./packages/app' --parallel",
    "dev:app": "turbo run dev --filter=@hierarchidb/app"
  }
}
```

## メリット

1. **一貫性**: 全ライブラリパッケージが同じビルドツール
2. **高速化**: tsupはesbuildベースで高速
3. **シンプル**: 設定ファイルが統一され管理が容易
4. **柔軟性**: ESM/CJS両対応、Tree-shaking対応
5. **DX向上**: watch modeが高速、ソースマップ対応

## 注意事項

1. **段階的移行**: 一度に全パッケージを移行せず、グループごとに実施
2. **テスト**: 各移行後に全体のビルドとテストを実行
3. **CI/CD**: GitHub Actionsのキャッシュ戦略も更新が必要
4. **ドキュメント**: 移行完了後、CONTRIBUTINGガイドを更新

## タイムライン

- Week 1: Group A移行 + テスト
- Week 2: Group B移行 + テスト  
- Week 3: Group C移行 + テスト
- Week 4: Turbo設定最適化 + ドキュメント更新