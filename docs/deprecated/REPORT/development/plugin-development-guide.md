# Plugin Development Guide

## Quick Start

新しいプラグインを3層アーキテクチャで開発するためのステップバイステップガイドです。

## 1. プロジェクト構造作成

### ディレクトリ構造

```bash
mkdir -p packages/plugins/my-plugin/src/{shared,ui,worker}
cd packages/plugins/my-plugin
```

```
packages/plugins/my-plugin/
├── package.json
├── tsup.config.ts
├── README.md
└── src/
    ├── openstreetmap-type.ts
    ├── shared/
    │   ├── openstreetmap-type.ts
    │   ├── metadata.ts
    │   ├── types.ts
    │   └── constants.ts
    ├── ui/
    │   ├── openstreetmap-type.ts
    │   ├── plugin.ts
    │   ├── components/
    │   ├── hooks/
    │   ├── validation/
    │   └── lifecycle/
    └── worker/
        ├── openstreetmap-type.ts
        ├── plugin.ts
        ├── handlers/
        ├── database/
        ├── validation/
        └── lifecycle/
```

## 2. Package Configuration

### package.json

```json
{
  "name": "@hierarchidb/plugin-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "sideEffects": false,
  
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./shared": {
      "types": "./dist/shared/index.d.ts",
      "import": "./dist/shared/index.js"
    },
    "./ui": {
      "types": "./dist/ui/index.d.ts",
      "import": "./dist/ui/index.js"
    },
    "./worker": {
      "types": "./dist/worker/index.d.ts",
      "import": "./dist/worker/index.js"
    }
  },
  
  "dependencies": {
    "@hierarchidb/core": "workspace:*"
  },
  
  "peerDependencies": {
    "react": "^18.0.0",
    "@hierarchidb/worker": "workspace:*",
    "@hierarchidb/ui-client": "workspace:*"
  },
  
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "@hierarchidb/worker": { "optional": true },
    "@hierarchidb/ui-client": { "optional": true }
  },
  
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry
  {
    entry: ['src/openstreetmap-type.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    treeshake: true,
  },
  // Shared entry
  {
    entry: ['src/shared/openstreetmap-type.ts'],
    outDir: 'dist/shared',
    format: ['esm'],
    dts: true,
    treeshake: true,
  },
  // UI entry
  {
    entry: ['src/ui/openstreetmap-type.ts'],
    outDir: 'dist/ui',
    format: ['esm'],
    dts: true,
    treeshake: true,
    external: ['react', 'react-dom', '@mui/material'],
  },
  // Worker entry
  {
    entry: ['src/worker/openstreetmap-type.ts'],
    outDir: 'dist/worker',
    format: ['esm'],
    dts: true,
    treeshake: true,
    external: ['@hierarchidb/worker', 'dexie'],
  },
]);
```

## 3. Shared Layer Implementation

### src/shared/types.ts

```typescript
import type { NodeId, EntityId } from '@hierarchidb/core';

export interface MyPluginEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  description?: string;
  
  // プラグイン固有のプロパティ
  customField: string;
  settings: MyPluginSettings;
  
  // 標準プロパティ
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface MyPluginSettings {
  enabled: boolean;
  configuration: Record<string, unknown>;
}

export interface CreateMyPluginData {
  name: string;
  description?: string;
  customField: string;
  settings?: Partial<MyPluginSettings>;
}

export interface UpdateMyPluginData extends Partial<CreateMyPluginData> {
  // 更新時に変更可能なフィールド
}
```

### src/shared/metadata.ts

```typescript
import type { PluginMetadata } from '@hierarchidb/core';

export const MyPluginMetadata: PluginMetadata = {
  nodeType: 'my-plugin',
  name: 'MyPlugin',
  displayName: 'My Custom Plugin',
  
  icon: {
    name: 'extension',
    emoji: '🔌',
    color: '#FF6B35'
  },
  
  category: {
    treeId: '*',
    menuGroup: 'advanced',
    createOrder: 100,
  },
  
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedOperations: ['create', 'read', 'update', 'delete'],
  },
  
  validation: {
    namePattern: '^[a-zA-Z0-9\\s\\-_]+$',
    maxChildren: 0,
  },
  
  ui: {
    dialogComponentPath: '@hierarchidb/plugin-my-plugin/components/MyPluginDialog',
    panelComponentPath: '@hierarchidb/plugin-my-plugin/components/MyPluginPanel',
    iconComponentPath: '@hierarchidb/plugin-my-plugin/components/MyPluginIcon',
  },
  
  meta: {
    version: '1.0.0',
    author: 'Your Name',
    description: 'Custom plugin for specific functionality',
    tags: ['custom', 'example'],
    experimental: false,
  },
};
```

### src/shared/constants.ts

```typescript
export const DEFAULT_SETTINGS: MyPluginSettings = {
  enabled: true,
  configuration: {},
} as const;

export const VALIDATION_RULES = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
} as const;
```

### src/shared/openstreetmap-type.ts

```typescript
export { MyPluginMetadata } from './metadata';
export * from './types';
export * from './constants';
```

## 4. UI Layer Implementation

### src/ui/components/MyPluginDialog/MyPluginDialog.tsx

```typescript
import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import type { NodeId } from '@hierarchidb/core';
import type { CreateMyPluginData } from '../../shared/types';

interface MyPluginDialogProps {
  open: boolean;
  nodeId: NodeId;
  onClose: () => void;
  onCreate: (data: CreateMyPluginData) => Promise<void>;
}

export const MyPluginDialog: React.FC<MyPluginDialogProps> = ({
  open,
  nodeId,
  onClose,
  onCreate,
}) => {
  const [formData, setFormData] = useState<CreateMyPluginData>({
    name: '',
    description: '',
    customField: '',
  });

  const handleSubmit = useCallback(async () => {
    try {
      await onCreate(formData);
      onClose();
    } catch (error) {
      console.error('Failed to create plugin:', error);
    }
  }, [formData, onCreate, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create My Plugin</DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
            fullWidth
          />
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            multiline
            rows={2}
            fullWidth
          />
          
          <TextField
            label="Custom Field"
            value={formData.customField}
            onChange={(e) => setFormData(prev => ({ ...prev, customField: e.target.value }))}
            required
            fullWidth
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!formData.name || !formData.customField}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### src/ui/hooks/useMyPluginForm.ts

```typescript
import { useState, useCallback } from 'react';
import type { CreateMyPluginData, MyPluginEntity } from '../../shared/types';
import { VALIDATION_RULES } from '../../shared/constants';

interface ValidationErrors {
  name?: string;
  customField?: string;
  description?: string;
}

export const useMyPluginForm = () => {
  const [formData, setFormData] = useState<CreateMyPluginData>({
    name: '',
    customField: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateForm = useCallback((data: CreateMyPluginData): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    // Name validation
    if (!data.name?.trim()) {
      newErrors.name = 'Name is required';
    } else if (data.name.length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      newErrors.name = `Name must be at least ${VALIDATION_RULES.NAME_MIN_LENGTH} characters`;
    } else if (data.name.length > VALIDATION_RULES.NAME_MAX_LENGTH) {
      newErrors.name = `Name must be less than ${VALIDATION_RULES.NAME_MAX_LENGTH} characters`;
    }

    // Custom field validation
    if (!data.customField?.trim()) {
      newErrors.customField = 'Custom field is required';
    }

    // Description validation
    if (data.description && data.description.length > VALIDATION_RULES.DESCRIPTION_MAX_LENGTH) {
      newErrors.description = `Description must be less than ${VALIDATION_RULES.DESCRIPTION_MAX_LENGTH} characters`;
    }

    return newErrors;
  }, []);

  const updateField = useCallback(<K extends keyof CreateMyPluginData>(
    field: K,
    value: CreateMyPluginData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const validate = useCallback(() => {
    const newErrors = validateForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateForm]);

  return {
    formData,
    errors,
    updateField,
    validate,
    isValid: Object.keys(errors).length === 0,
  };
};
```

### src/ui/plugin.ts

```typescript
import type { UIPlugin } from '@hierarchidb/ui-client';
import { MyPluginMetadata } from '../shared/metadata';
import { MyPluginDialog } from './components/MyPluginDialog';
import { MyPluginPanel } from './components/MyPluginPanel';
import { MyPluginIcon } from './components/MyPluginIcon';
import type { CreateMyPluginData, MyPluginEntity } from '../shared/types';

export const MyPluginUIPlugin: UIPlugin = {
  metadata: MyPluginMetadata,
  
  components: {
    DialogComponent: MyPluginDialog,
    PanelComponent: MyPluginPanel,
    IconComponent: MyPluginIcon,
  },
  
  validation: {
    validateForm: (data: CreateMyPluginData) => {
      const errors: Array<{ field: string; message: string }> = [];
      
      if (!data.name?.trim()) {
        errors.push({ field: 'name', message: 'Name is required' });
      }
      
      if (!data.customField?.trim()) {
        errors.push({ field: 'customField', message: 'Custom field is required' });
      }
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  
  lifecycle: {
    beforeCreate: async (data: CreateMyPluginData) => {
      console.log('UI: Preparing to create my plugin:', data.name);
    },
    
    afterCreate: async (entity: MyPluginEntity) => {
      // Show success notification
      if (typeof window !== 'undefined' && 'showSuccessNotification' in window) {
        (window as any).showSuccessNotification(
          `Plugin "${entity.name}" created successfully`
        );
      }
    },
    
    beforeDelete: async (entity: MyPluginEntity) => {
      // Show confirmation dialog
      const confirmed = confirm(`Delete plugin "${entity.name}"?`);
      if (!confirmed) {
        throw new Error('Delete cancelled by user');
      }
    },
  },
};
```

## 5. Worker Layer Implementation

### src/worker/handlers/MyPluginEntityHandler.ts

```typescript
import type { NodeId, EntityId } from '@hierarchidb/core';
import type { 
  MyPluginEntity, 
  CreateMyPluginData, 
  UpdateMyPluginData 
} from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

export class MyPluginEntityHandler {
  constructor() {
    console.log('MyPluginEntityHandler initialized');
  }

  async createEntity(nodeId: NodeId, data: CreateMyPluginData): Promise<MyPluginEntity> {
    const now = Date.now();
    
    const entity: MyPluginEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId,
      name: data.name,
      description: data.description || '',
      customField: data.customField,
      settings: {
        ...DEFAULT_SETTINGS,
        ...data.settings,
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // TODO: 実際のデータベース保存
    // await this.database.entities.add(entity);
    
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<MyPluginEntity | undefined> {
    // TODO: 実際のデータベース取得
    // return await this.database.entities.get(nodeId);
    return undefined;
  }

  async updateEntity(nodeId: NodeId, data: UpdateMyPluginData): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`MyPlugin entity not found: ${nodeId}`);
    }

    const updated: MyPluginEntity = {
      ...existing,
      ...data,
      nodeId, // Ensure nodeId is not overwritten
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    // TODO: 実際のデータベース更新
    // await this.database.entities.update(nodeId, updated);
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    // TODO: 実際のデータベース削除
    // await this.database.entities.delete(nodeId);
    console.log(`Deleting my plugin entity: ${nodeId}`);
  }

  // プラグイン固有のメソッド
  async updateSettings(nodeId: NodeId, settings: Partial<MyPluginEntity['settings']>): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`MyPlugin entity not found: ${nodeId}`);
    }

    await this.updateEntity(nodeId, {
      settings: {
        ...entity.settings,
        ...settings,
      },
    });
  }

  async isEnabled(nodeId: NodeId): Promise<boolean> {
    const entity = await this.getEntity(nodeId);
    return entity?.settings.enabled ?? false;
  }
}
```

### src/worker/plugin.ts

```typescript
import type { WorkerPlugin } from '@hierarchidb/worker';
import { MyPluginMetadata } from '../shared/metadata';
import { MyPluginEntityHandler } from './handlers/MyPluginEntityHandler';
import type { MyPluginEntity } from '../shared/types';

export const MyPluginWorkerPlugin: WorkerPlugin<MyPluginEntity> = {
  metadata: MyPluginMetadata,
  
  entityHandler: new MyPluginEntityHandler(),
  
  database: {
    tableName: 'my_plugins',
    schema: '&id, nodeId, name, customField, createdAt, updatedAt, version',
    version: 1,
  },
  
  validation: {
    validateEntity: async (entity: MyPluginEntity) => {
      const errors: Array<{ field: string; message: string }> = [];
      
      // Database-level validations
      // TODO: Check for duplicate names
      // const existingWithSameName = await checkNameExists(entity.name, entity.nodeId);
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  
  lifecycle: {
    afterCreate: async (nodeId: NodeId, entity: MyPluginEntity) => {
      console.log(`Worker: MyPlugin created - ${entity.name} (${nodeId})`);
      
      // Initialize plugin-specific resources
      await initializeMyPluginResources(nodeId, entity);
    },
    
    beforeDelete: async (nodeId: NodeId, entity: MyPluginEntity) => {
      console.log(`Worker: Cleaning up MyPlugin - ${nodeId}`);
      
      // Cleanup plugin-specific resources
      await cleanupMyPluginResources(nodeId);
    },
  },
};

// Helper functions
async function initializeMyPluginResources(nodeId: NodeId, entity: MyPluginEntity): Promise<void> {
  // Initialize any resources needed for this plugin
  console.log(`Initializing resources for ${entity.name}`);
}

async function cleanupMyPluginResources(nodeId: NodeId): Promise<void> {
  // Cleanup any resources associated with this plugin
  console.log(`Cleaning up resources for ${nodeId}`);
}
```

## 6. Integration & Export

### src/openstreetmap-type.ts

```typescript
// Main entry point
export * from './shared';

// Conditional exports for tree-shaking
export * from './ui';
export * from './worker';

// Namespace exports
export * as Shared from './shared';
export * as UI from './ui';
export * as Worker from './worker';
```

### src/ui/openstreetmap-type.ts

```typescript
export { MyPluginUIPlugin } from './plugin';
export * from './components';
export * from './hooks';
export * from './validation';
export * from './lifecycle';
```

### src/worker/openstreetmap-type.ts

```typescript
export { MyPluginWorkerPlugin } from './plugin';
export * from './handlers';
export * from './database';
export * from './validation';
export * from './lifecycle';
```

## 7. Usage Examples

### UI側での使用

```typescript
// アプリケーション初期化
import { MyPluginUIPlugin } from '@hierarchidb/plugin-my-plugin/ui';
import { UIPluginRegistry } from '@hierarchidb/ui-client';

const registry = UIPluginRegistry.getInstance();
registry.register(MyPluginUIPlugin);

// コンポーネントでの使用
import { useMyPluginForm } from '@hierarchidb/plugin-my-plugin/ui';

const MyComponent = () => {
  const { formData, updateField, validate } = useMyPluginForm();
  // ...
};
```

### Worker側での使用

```typescript
// Worker初期化
import { MyPluginWorkerPlugin } from '@hierarchidb/plugin-my-plugin/worker';
import { WorkerPluginRegistry } from '@hierarchidb/worker';

const registry = WorkerPluginRegistry.getInstance();
registry.register(MyPluginWorkerPlugin);
```

### 型のみの使用

```typescript
// 型定義のみインポート（バンドルサイズ0）
import type { MyPluginEntity, CreateMyPluginData } from '@hierarchidb/plugin-my-plugin/shared';

interface SomeService {
  processMyPlugin(data: CreateMyPluginData): Promise<MyPluginEntity>;
}
```

## Testing

### Unit Tests

```typescript
// src/ui/__tests__/MyPluginDialog.test.tsx
import { render, screen } from '@testing-library/react';
import { MyPluginDialog } from '../components/MyPluginDialog';

describe('MyPluginDialog', () => {
  it('should render form fields', () => {
    render(
      <MyPluginDialog
        open={true}
        nodeId={'test' as NodeId}
        onClose={() => {}}
        onCreate={async () => {}}
      />
    );

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom Field')).toBeInTheDocument();
  });
});

// src/worker/__tests__/MyPluginEntityHandler.test.ts
import { MyPluginEntityHandler } from '../handlers/MyPluginEntityHandler';

describe('MyPluginEntityHandler', () => {
  let handler: MyPluginEntityHandler;

  beforeEach(() => {
    handler = new MyPluginEntityHandler();
  });

  it('should create entity with correct structure', async () => {
    const nodeId = 'test-node' as NodeId;
    const data = {
      name: 'Test Plugin',
      customField: 'test-value',
    };

    const entity = await handler.createEntity(nodeId, data);

    expect(entity.nodeId).toBe(nodeId);
    expect(entity.name).toBe(data.name);
    expect(entity.customField).toBe(data.customField);
    expect(entity.version).toBe(1);
  });
});
```

## Testing Strategy

### テストファイル構造
新しい3層アーキテクチャに対応したテスト構造を作成します：

```
packages/plugins/my-plugin/src/
├── shared/__tests__/
│   ├── validation.test.ts      # バリデーション・型ガードテスト
│   ├── utils.test.ts          # ユーティリティ関数テスト
│   └── constants.test.ts       # 定数値テスト
├── worker/__tests__/
│   ├── MyPluginEntityHandler.test.ts  # エンティティハンドラーテスト
│   ├── api.test.ts                     # プラグインAPI実装テスト
│   └── integration/
│       └── full-workflow.test.ts       # 統合テスト
└── ui/__tests__/
    ├── hooks/
    │   └── useMyPluginAPI.test.tsx     # React hooksテスト
    └── components/
        ├── MyPluginDialog.test.tsx     # ダイアログコンポーネントテスト
        └── MyPluginPanel.test.tsx      # パネルコンポーネントテスト
```

### テストセットアップ

```bash
# テスト実行環境のセットアップ
pnpm add -D vitest @testing-library/react @testing-library/user-event happy-dom fake-indexeddb
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      thresholds: {
        'src/shared/**': { lines: 95 },
        'src/worker/**': { lines: 85 },
        'src/ui/**': { lines: 80 }
      }
    }
  }
});

// vitest.setup.ts
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
```

### テスト実行

```bash
# 層別テスト実行
pnpm test src/shared        # 共通層のみ
pnpm test src/worker        # Worker層のみ
pnpm test src/ui           # UI層のみ

# カバレッジ付き実行
pnpm test:coverage

# ウォッチモード
pnpm test --watch
```

詳細は [Plugin Testing Guide](./plugin-testing-guide.md) を参照してください。

## Development Workflow

### 1. 開発時の品質チェック

```bash
# 型チェック
pnpm typecheck

# リント
pnpm lint

# テスト実行
pnpm test:run

# ビルド検証
pnpm build
```

### 2. デバッグ手法

```bash
# 特定のテストをデバッグ
pnpm test MyPluginDialog --watch

# カバレッジレポートで漏れ確認
pnpm test:coverage --open

# ビルド出力確認
pnpm build && ls -la dist/
```

## Best Practices

1. **Layer Separation**: 各層の責任を明確に分離
2. **Type Safety**: 共通型定義を基盤とした型安全性
3. **Error Handling**: 各層に適したエラー処理
4. **Comprehensive Testing**: 各層に応じたテスト戦略
5. **Documentation**: 使用法とAPIの明確な文書化

## Related Documentation

- [Plugin Architecture Overview](../04-plugin-architecture.md) - 3層アーキテクチャの詳細
- [Type Safety Strategy](../05-type-safety-validation-strategy.md) - 型安全性とバリデーション
- [Plugin Testing Guide](./plugin-testing-guide.md) - テスト開発の実践ガイド
- [Plugin Migration](../migration/plugin-migration.md) - 既存プラグインの移行手順

これで新しいプラグインの開発・テスト環境が完全に整いました！