# 1.2 技術スタック詳細

## フロントエンド技術

### コアフレームワーク
| 技術 | バージョン | 用途 | 選定理由 |
|------|------------|------|----------|
| **React** | 19.1.1 | UIフレームワーク | 最新の並行レンダリング機能 |
| **TypeScript** | 5.7.3 | 型システム | 型安全性と開発効率 |
| **React Router** | 7.x | ルーティング | ファイルベースルーティング |
| **Material-UI** | 6.x | UIコンポーネント | エンタープライズ品質 |

### 状態管理
```typescript
// Comlink経由でWorkerの状態を管理
const workerAPI = Comlink.wrap<WorkerAPI>(worker);
const observableAPI = await workerAPI.getObservableAPI();
```

### スタイリング
- **CSS-in-JS**: MUI Theme System
- **CSS Modules**: コンポーネント固有スタイル
- **Tailwind CSS**: ユーティリティクラス（検討中）

## バックエンド技術（Worker Layer）

### データ処理
| 技術 | 用途 | 特徴 |
|------|------|------|
| **Web Worker** | バックグラウンド処理 | UIブロッキング回避 |
| **Comlink** | RPC通信 | 型安全なWorker通信 |
| **Dexie.js** | IndexedDB wrapper | 高速なデータベース操作 |

### データベース設計
```typescript
// 二層データベース戦略
class CoreDB extends Dexie {
  // 永続データ
  trees!: Table<Tree, TreeId>;
  nodes!: Table<TreeNode, NodeId>;
}

class EphemeralDB extends Dexie {
  // 一時データ（24時間で自動削除）
  workingCopies!: Table<WorkingCopy, UUID>;
  sessions!: Table<SessionData, UUID>;
}
```

## ビルドツール

### パッケージ管理
- **pnpm**: 8.x - 効率的なモノレポ管理
- **Turborepo**: 並列ビルド最適化
- **Changesets**: バージョン管理

### ビルド設定
```javascript
// tsup.config.ts
export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'es2022'
});
```

### 開発ツール
| ツール | 用途 | 設定 |
|--------|------|------|
| **Vite** | 開発サーバー・バンドラー | HMR、高速ビルド |
| **tsup** | ライブラリビルド | ESM/CJS両対応 |
| **tsc** | 型チェック | strict mode |
| **ESLint** | コード品質 | カスタムルール |
| **Prettier** | コードフォーマット | 自動整形 |

## テスト技術

### テストフレームワーク
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      threshold: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
```

### テスト戦略
- **Vitest**: 単体テスト・統合テスト
- **Playwright**: E2Eテスト
- **React Testing Library**: コンポーネントテスト
- **fake-indexeddb**: データベーステスト

## プラグインシステム

### プラグインアーキテクチャ
```typescript
interface PluginDefinition {
  // メタデータ
  metadata: PluginMetadata;
  
  // UI層定義
  ui: {
    components: UIComponents;
    hooks: UIHooks;
  };
  
  // Worker層定義
  worker: {
    entityHandler: EntityHandler;
    api: PluginAPI;
  };
  
  // 共通定義
  shared: {
    types: TypeDefinitions;
    validation: ValidationRules;
  };
}
```

### 実装済みプラグイン
1. **BaseMap**: OpenStreetMap/地理院地図統合
2. **StyleMap**: GIS スタイル管理
3. **Shape**: 地理データ処理（バッチ処理対応）
4. **Project**: プロジェクト管理
5. **Spreadsheet**: 表データ処理

## 外部依存関係

### 主要ライブラリ
| ライブラリ | バージョン | ライセンス | 用途 |
|------------|------------|------------|------|
| react | 19.1.1 | MIT | UIフレームワーク |
| dexie | 4.x | Apache-2.0 | IndexedDB |
| comlink | 4.x | Apache-2.0 | Worker通信 |
| @mui/material | 6.x | MIT | UIコンポーネント |
| maplibre-gl | 4.x | BSD-3 | 地図表示 |

### セキュリティ考慮
- 定期的な依存関係監査（`pnpm audit`）
- Renovate botによる自動更新
- ライセンスコンプライアンスチェック

## パフォーマンス最適化

### コード分割
```typescript
// 動的インポートによる遅延ロード
const MapPlugin = lazy(() => import('./plugins/map'));
const SpreadsheetPlugin = lazy(() => import('./plugins/spreadsheet'));
```

### バンドルサイズ
| パッケージ | 圧縮前 | 圧縮後 | gzip |
|-----------|--------|--------|------|
| @hierarchidb/core | 45KB | 28KB | 9KB |
| @hierarchidb/api | 23KB | 15KB | 5KB |
| @hierarchidb/worker | 180KB | 120KB | 38KB |
| @hierarchidb/ui-client | 95KB | 62KB | 21KB |

### 最適化技術
- Tree Shaking
- Dead Code Elimination
- Minification
- Compression (gzip/brotli)
- Code Splitting
- Lazy Loading

## 開発環境

### 推奨環境
- **Node.js**: 20.x LTS
- **pnpm**: 8.x
- **OS**: macOS/Linux/Windows (WSL2)
- **IDE**: VSCode with TypeScript extensions

### 環境変数
```bash
# .env.development
VITE_APP_NAME=
VITE_API_URL=http://localhost:3000
VITE_ENABLE_DEBUG=true

# .env.production
VITE_APP_NAME=hierarchidb
VITE_API_URL=https://api.hierarchidb.com
VITE_ENABLE_DEBUG=false
```

## CI/CD

### GitHub Actions
```yaml
# .github/workflows/ci.yml
- Build & Test
- Type Check
- Lint & Format
- Coverage Report
- Bundle Size Check
```

### デプロイメント
- **GitHub Pages**: 静的サイトホスティング
- **Cloudflare Workers**: エッジコンピューティング
- **Vercel**: プレビューデプロイ