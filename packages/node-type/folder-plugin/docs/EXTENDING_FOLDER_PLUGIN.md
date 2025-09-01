# Folderプラグイン拡張ガイド

## 概要

このドキュメントでは、folderプラグインを基底として、他のプラグインを差分的に開発する方法について説明します。folderプラグインは、名前(name)と説明(description)という基本的なフィールドを持つシンプルな構造のため、他のプラグインの基底として最適です。

## なぜFolderプラグインを拡張するのか

### 利点

1. **共通UIの再利用**: name/descriptionフィールドの入力UI・バリデーションを継承
2. **コード削減**: 基本的なCRUD操作やWorking Copyパターンを再利用
3. **一貫性**: 全プラグインで統一されたユーザー体験を提供
4. **保守性**: 基底プラグインの改善が全拡張プラグインに自動反映

### 適用例

- **Stylerプラグイン**: CSVファイルのアップロード、カラム選択、カラーマッピング機能を追加
- **Projectプラグイン**: プロジェクト設定、メンバー管理機能を追加
- **Documentプラグイン**: リッチテキスト編集、バージョン管理機能を追加

## 拡張アーキテクチャ

```typescript
// 継承関係の例
FolderPlugin (基底)
  ├── StylerPlugin (拡張: ファイルアップロード + データ可視化)
  ├── ProjectPlugin (拡張: プロジェクト管理機能)
  └── DocumentPlugin (拡張: ドキュメント編集機能)
```

## Step by Step 実装ガイド

### Step 1: プラグイン拡張定義の作成

```typescript
// packages/node-type-plugin/styler-plugin/src/extension/definition.ts

import type { 
  ExtendableNodeTypeDefinition,
  DialogStepDefinition 
} from '@hierarchidb/common-core/types/plugin-extension';
import { FileUploadStep } from '../steps/FileUploadStep';
import { ColumnSelectionStep } from '../steps/ColumnSelectionStep';
import { ColorMappingStep } from '../steps/ColorMappingStep';

export const StylerExtension: ExtendableNodeTypeDefinition<
  FolderEntity,
  StylerEntity,
  StylerWorkingCopy
> = {
  // 1. 基底プラグインを指定
  extends: 'folder-plugin',
  
  // 2. 独自のメタデータ
  nodeType: 'styler-plugin',
  name: 'Styler',
  displayName: 'Style Map',
  icon: 'map',
  color: '#4CAF50',
  
  // 3. 追加ステップの定義（Step 1は自動的にfolderから継承）
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'Upload File',
      component: FileUploadStep,
      validation: {
        validate: async (data) => {
          if (!data.file) {
            return { isValid: false, errors: ['File is required'] };
          }
          return { isValid: true, errors: [] };
        }
      }
    },
    {
      stepNumber: 3,
      title: 'Select Columns',
      component: ColumnSelectionStep,
      dependsOn: [2], // Step 2に依存
      validation: {
        validate: async (data) => {
          if (data.keyColumn === data.valueColumn) {
            return { 
              isValid: false, 
              errors: ['Key and value columns must be different'] 
            };
          }
          return { isValid: true, errors: [] };
        }
      }
    },
    {
      stepNumber: 4,
      title: 'Configure Colors',
      component: ColorMappingStep,
      dependsOn: [3],
      isOptional: false
    }
  ],
  
  // 4. 追加フィールドの定義
  extendedFields: [
    {
      name: 'keyColumn',
      type: 'string',
      required: true,
      label: 'Key Column',
      description: 'Column to use as map key'
    },
    {
      name: 'valueColumn',
      type: 'string',
      required: true,
      label: 'Value Column',
      description: 'Column for color mapping'
    },
    {
      name: 'colorRules',
      type: 'array',
      required: false,
      label: 'Color Rules'
    }
  ],
  
  // 5. 拡張バリデーション
  extendedValidation: {
    extendedRules: {
      fileFormat: {
        validate: (value) => {
          return /\.(csv|tsv)$/i.test(value.file?.name || '');
        },
        message: 'File must be CSV or TSV format'
      }
    },
    chainMode: 'all',
    mergeStrategy: 'append'
  }
};
```

### Step 2: 拡張エンティティの定義

```typescript
// packages/node-type-plugin/styler-plugin/src/entities/StylerEntity.ts

import type { FolderEntity } from '@hierarchidb/plugin-folder-plugin';

// FolderEntityを拡張
export interface StylerEntity extends FolderEntity {
  // Folderから継承されるフィールド:
  // - id, nodeId, name, description, settings, metadata
  // - createdAt, updatedAt, version
  
  // Styler固有のフィールド:
  keyColumn: string;
  valueColumn: string;
  colorRules: StylerColorRule[];
  defaultStyle: StylerStyle;
  fileHash?: string;
  cacheKey?: string;
}

export interface StylerColorRule {
  column: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
  style: StylerStyle;
}

export interface StylerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  opacity?: number;
}
```

### Step 3: 拡張ハンドラーの実装

```typescript
// packages/node-type-plugin/styler-plugin/src/handlers/StylerEntityHandler.ts

import { FolderEntityHandler } from '@hierarchidb/plugin-folder-plugin';
import type { BaseEntityExtension } from '@hierarchidb/common-core/types/plugin-extension';

export class StylerEntityHandler 
  extends FolderEntityHandler 
  implements BaseEntityExtension<FolderEntity, StylerEntity> {
  
  // FolderEntityHandlerから継承される基本CRUD操作:
  // - createEntity, getEntity, updateEntity, deleteEntity
  // - createWorkingCopy, commitWorkingCopy, discardWorkingCopy
  
  // Styler固有の拡張データ取得
  async getExtendedData(nodeId: NodeId): Promise<Partial<StylerEntity>> {
    const entity = await this.getEntity(nodeId);
    if (!entity) return {};
    
    // Styler固有のデータを取得
    return {
      keyColumn: entity.keyColumn,
      valueColumn: entity.valueColumn,
      colorRules: entity.colorRules || [],
      defaultStyle: entity.defaultStyle || {},
      fileHash: entity.fileHash
    };
  }
  
  // Styler固有の拡張データ保存
  async saveExtendedData(
    nodeId: NodeId, 
    data: Partial<StylerEntity>
  ): Promise<void> {
    // 基底のupdateEntityを使用して拡張データも保存
    await this.updateEntity(nodeId, {
      ...data,
      updatedAt: Date.now()
    });
    
    // キャッシュ更新などの追加処理
    if (data.fileHash) {
      await this.updateCache(nodeId, data.fileHash);
    }
  }
  
  // Styler固有のメソッド
  private async updateCache(nodeId: NodeId, fileHash: string): Promise<void> {
    // キャッシュ更新ロジック
  }
  
  async processCSVFile(
    nodeId: NodeId, 
    file: File
  ): Promise<ProcessedData> {
    // CSV処理ロジック
  }
  
  async generateColorMapping(
    data: any[], 
    config: ColorMappingConfig
  ): Promise<ColorMapping> {
    // カラーマッピング生成
  }
}
```

### Step 4: ステップコンポーネントの実装

```typescript
// packages/node-type-plugin/styler-plugin/src/steps/FileUploadStep.tsx

import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

export interface FileUploadStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const FileUploadStep: React.FC<FileUploadStepProps> = ({
  data,
  onNext,
  onPrevious,
  errors
}) => {
  const [file, setFile] = useState<File | null>(data.file || null);
  const [preview, setPreview] = useState<string[]>([]);
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // ファイルの最初の10行をプレビュー
    const text = await selectedFile.text();
    const lines = text.split('\n').slice(0, 10);
    setPreview(lines);
  };
  
  const handleNext = () => {
    onNext({ ...data, file });
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload CSV/TSV File
      </Typography>
      
      <Button
        variant="contained"
        component="label"
        startIcon={<CloudUpload />}
        sx={{ mb: 2 }}
      >
        Choose File
        <input
          type="file"
          hidden
          accept=".csv,.tsv"
          onChange={handleFileSelect}
        />
      </Button>
      
      {file && (
        <Box>
          <Typography variant="body2">
            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </Typography>
        </Box>
      )}
      
      {preview.length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" component="pre">
            {preview.join('\n')}
          </Typography>
        </Box>
      )}
      
      {errors?.map((error, index) => (
        <Typography key={index} color="error" variant="caption">
          {error}
        </Typography>
      ))}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onPrevious}>
          Previous
        </Button>
        <Button 
          variant="contained" 
          onClick={handleNext}
          disabled={!file}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};
```

### Step 5: プラグインの登録

```typescript
// packages/node-type-plugin/styler-plugin/src/index.ts

import { PluginExtensionRegistry } from '@hierarchidb/runtime-plugin-base';
import { StylerExtension } from './extension/definition';
import { StylerEntityHandler } from './handlers/StylerEntityHandler';

// プラグイン拡張を登録
export function registerStylerPlugin(): void {
  PluginExtensionRegistry.register({
    extension: StylerExtension,
    handler: new StylerEntityHandler(),
    database: {
      // FolderのDBスキーマを拡張
      extends: 'folders',
      additionalColumns: {
        'keyColumn, valueColumn': '',
        'fileHash, cacheKey': ''
      }
    }
  });
}
```

## ベストプラクティス

### 1. 最小限の拡張

基底プラグインの機能をできるだけ活用し、本当に必要な部分だけを拡張する。

```typescript
// ❌ 悪い例: 全て再実装
export class BadHandler {
  async createEntity() { /* 独自実装 */ }
  async getEntity() { /* 独自実装 */ }
  // ...全メソッド再実装
}

// ✅ 良い例: 必要な部分だけ拡張
export class GoodHandler extends FolderEntityHandler {
  // 基底のメソッドは継承して使用
  // 固有の処理だけ追加
  async processSpecificData() { /* 固有処理 */ }
}
```

### 2. 型安全性の維持

TypeScriptの型システムを最大限活用して、拡張時の型安全性を保つ。

```typescript
// 型パラメータで基底と拡張の関係を明示
export class TypeSafeHandler<
  TBase extends FolderEntity,
  TExtended extends TBase
> extends FolderEntityHandler {
  // 型安全な拡張
}
```

### 3. バリデーションの継承と拡張

基底のバリデーションを活かしつつ、必要な検証を追加。

```typescript
export const extendedValidation = {
  // 基底のバリデーションは自動適用
  // 追加のバリデーションのみ定義
  extendedRules: {
    customRule: {
      validate: (value) => /* 検証ロジック */,
      message: 'Custom validation failed'
    }
  },
  mergeStrategy: 'append' // 基底に追加
};
```

### 4. UIの段階的拡張

ステップ番号を使って、UIを段階的に拡張。

```typescript
// Step 1: 基底（name/description） - 自動継承
// Step 2-N: 拡張プラグイン固有のステップ
extendedSteps: [
  { stepNumber: 2, title: 'Extension Step 1', /* ... */ },
  { stepNumber: 3, title: 'Extension Step 2', /* ... */ }
]
```

## トラブルシューティング

### Q1: 基底プラグインのメソッドが呼ばれない

**原因**: メソッドのオーバーライドで`super`を呼び忘れている。

```typescript
// ❌ 問題のあるコード
async updateEntity(nodeId: NodeId, data: any) {
  // superを呼んでいない
  await this.customUpdate(nodeId, data);
}

// ✅ 修正後
async updateEntity(nodeId: NodeId, data: any) {
  // 基底の処理を実行
  await super.updateEntity(nodeId, data);
  // 追加の処理
  await this.customUpdate(nodeId, data);
}
```

### Q2: ステップの依存関係が機能しない

**原因**: `dependsOn`配列のステップ番号が間違っている。

```typescript
// ❌ 問題のあるコード
extendedSteps: [
  { stepNumber: 2, dependsOn: [0] } // Step 0は存在しない
]

// ✅ 修正後
extendedSteps: [
  { stepNumber: 2, dependsOn: [1] } // Step 1（基底）に依存
]
```

### Q3: 拡張フィールドがDBに保存されない

**原因**: データベーススキーマの拡張を忘れている。

```typescript
// ✅ 必要な設定
database: {
  extends: 'folders',
  additionalColumns: {
    'myNewField': 'string',
    'anotherField': 'number'
  }
}
```

## サンプルプロジェクト

完全な実装例は以下を参照：

- [Stylerプラグイン](../../../styler) - CSV/TSVファイルの可視化
- [Projectプラグイン](../../../project) - プロジェクト管理機能
- [Shapeプラグイン](../../../shape) - 図形データ管理

## 関連ドキュメント

- [プラグイン拡張システム型定義](../../../../common/core/src/types/plugin-extension.ts)
- [Folderプラグイン実装](../src/index.ts)
- [HierarchiDBプラグインアーキテクチャ](../../../../../docs/architecture/plugin-system.md)