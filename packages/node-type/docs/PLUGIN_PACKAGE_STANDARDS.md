# プラグインパッケージ標準構成

## 📁 標準ディレクトリ構造

```
my-plugin/
├── package.json                    # パッケージメタデータ
├── tsconfig.json                   # TypeScript設定
├── tsup.config.ts                  # ビルド設定
├── vitest.config.ts               # テスト設定
├── vitest.setup.ts                # テストセットアップ
├── README.md                      # プラグイン概要
├── src/                          # ソースコード
│   ├── index.ts                  # メインエクスポート
│   ├── types/                    # 型定義
│   │   └── index.ts
│   ├── entities/                 # エンティティ定義
│   │   └── MyEntity.ts
│   ├── handlers/                 # エンティティハンドラ
│   │   └── MyEntityHandler.ts
│   ├── definitions/              # プラグイン定義
│   │   └── MyPluginDefinition.ts
│   ├── shared/                   # 共通コード
│   │   ├── index.ts
│   │   ├── lifecycle-types.ts
│   │   ├── constants.ts
│   │   ├── utils.ts
│   │   ├── api.ts
│   │   └── metadata.ts
│   ├── ui/                      # UI層（フロントエンド）
│   │   ├── index.ts
│   │   ├── plugin.ts
│   │   ├── components/
│   │   └── hooks/
│   ├── worker/                  # Worker層（バックエンド）
│   │   ├── index.ts
│   │   ├── plugin.ts
│   │   ├── api.ts
│   │   ├── handlers/
│   │   └── services/
│   ├── components/              # React コンポーネント
│   │   ├── index.ts
│   │   ├── MyDialog.tsx
│   │   └── MyPanel.tsx
│   ├── hooks/                   # React フック
│   │   └── index.ts
│   ├── api/                     # API インターフェース
│   │   └── MyAPI.ts
│   ├── database/                # データベース管理
│   │   └── MyDatabase.ts
│   ├── services/                # ビジネスロジック
│   │   └── MyService.ts
│   ├── utils/                   # ユーティリティ
│   │   └── index.ts
│   ├── locales/                 # 国際化
│   │   ├── en/
│   │   └── ja/
│   ├── __tests__/              # テストファイル
│   │   ├── integration/
│   │   ├── fixtures/
│   │   └── *.test.ts
│   └── mock/                   # モックデータ
│       └── data.ts
├── docs/                       # ドキュメント
│   ├── README.md
│   ├── API_REFERENCE.md
│   └── IMPLEMENTATION_GUIDE.md
└── plugin.config.ts           # プラグイン設定（オプション）
```

## 🔧 必須ファイル

### 1. package.json
```json
{
  "name": "@hierarchidb/my-plugin",
  "version": "1.0.0",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hierarchidb/common-core": "workspace:*",
    "@hierarchidb/common-type": "workspace:*",
    "@hierarchidb/ui-core": "workspace:*"
  }
}
```

### 2. src/index.ts（メインエクスポート）
```typescript
// エンティティエクスポート
export * from './entities/MyEntity';
export * from './handlers/MyEntityHandler';
export * from './definitions/MyPluginDefinition';

// UIコンポーネント
export * from './components';
export * from './hooks';

// 共通型・ユーティリティ
export * from './shared';
export * from './types';

// プラグイン層エクスポート
export * from './ui';
export * from './worker';
```

### 3. src/definitions/MyPluginDefinition.ts
```typescript
import type { PluginDefinition } from '@hierarchidb/common-type';
import { MyEntityHandler } from '../handlers/MyEntityHandler';
import type { MyEntity, MyWorkingCopy } from '../entities/MyEntity';

export const MyPluginDefinition: PluginDefinition<MyEntity, never, MyWorkingCopy> = {
  nodeType: 'my-plugin',
  name: 'My Plugin',
  displayName: 'マイプラグイン',
  entityHandler: new MyEntityHandler(),
  
  database: {
    entityStore: 'my_entities',
    schema: {
      '&id': 'EntityId',
      'nodeId': 'NodeId',
      'name, description': '',
      'createdAt, updatedAt, version': '',
    },
    version: 1
  },
  
  category: {
    primary: 'data-management',
    secondary: 'custom',
    treeTypes: ['data-tree']
  }
};
```

## 🏗️ プラグイン階層構造

### ベースプラグイン
- **folder-plugin**: 基本的なフォルダ機能
- **basemap-plugin**: 地図機能の基盤

### 拡張プラグイン（継承パターン）
- **spreadsheet-plugin** ← folder-plugin
- **styler-plugin** ← spreadsheet-plugin  
- **shape-plugin** ← folder-plugin

## 📋 構成検証チェックリスト

### ✅ 必須ファイル
- [ ] package.json（適切なexports設定）
- [ ] tsconfig.json（@/*パス設定）
- [ ] tsup.config.ts（ビルド設定）
- [ ] src/index.ts（メインエクスポート）
- [ ] src/definitions/PluginDefinition.ts

### ✅ エンティティ層
- [ ] src/entities/Entity.ts
- [ ] src/handlers/EntityHandler.ts
- [ ] src/types/index.ts

### ✅ UI層
- [ ] src/ui/index.ts
- [ ] src/components/Dialog.tsx
- [ ] src/components/Panel.tsx
- [ ] src/hooks/useAPI.ts

### ✅ Worker層
- [ ] src/worker/index.ts
- [ ] src/worker/handlers/
- [ ] src/api/API.ts

### ✅ 共通コード
- [ ] src/shared/index.ts
- [ ] src/shared/lifecycle-types.ts
- [ ] src/shared/constants.ts

### ✅ 品質保証
- [ ] src/__tests__/（テストファイル）
- [ ] vitest.config.ts
- [ ] vitest.setup.ts
- [ ] docs/README.md

## 🔄 拡張プラグインの追加要件

### ExtensionAPI実装
```typescript
// src/api/MyExtensionAPI.ts
export interface MyExtensionAPI {
  getExtendedData(nodeId: NodeId): Promise<MyExtendedData>;
  processExtension(data: MyExtendedData): Promise<ProcessingResult>;
}
```

### 拡張定義
```typescript
// src/extension/definition.ts
export const MyExtension: ExtendableNodeTypeDefinition = {
  extends: 'base-plugin',
  nodeType: 'my-extended-plugin',
  extendedSteps: [...],
  extendedFields: [...],
  extendedValidation: {...}
};
```

## 🚨 よくある問題と修正

### 1. package.json exports設定不備
```json
// ❌ 間違い
"main": "dist/index.js"

// ✅ 正しい
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

### 2. TypeScript パス設定不備
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

### 3. テスト設定不備
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts']
  }
});
```

## 📊 現状プラグイン適合状況

| プラグイン | 構成適合度 | 主な問題 |
|-----------|------------|----------|
| folder-plugin | ✅ 95% | 軽微な構成調整 |
| shape-plugin | ✅ 90% | Worker層統合完了 |
| spreadsheet-plugin | ✅ 85% | CSV型統合完了 |
| styler-plugin | ✅ 80% | Handler統合完了 |
| basemap-plugin | ⚠️ 70% | 構成要修正 |

## 📝 次期対応項目

1. **basemap-plugin**の構成修正
2. **プラグイン間依存関係**の明確化
3. **ExtensionAPI**標準化
4. **テストカバレッジ**向上
5. **ドキュメント**完備