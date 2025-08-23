# HierarchiDB Import/Export機能移植計画書

## はじめに

このImport/Export機能移植計画書では、Eria Cartographから実証済みのImport/Export機能をHierarchiDBに移植するための詳細な実装戦略について説明します。本ドキュメントは以下のような方を対象としています：

**読むべき人**: 機能移植担当者、データ処理開発者、UI/UX開発者、ファイル処理実装者、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインのデータインポート/エクスポート機能を実装する開発者

**前提知識**: ファイル処理（ZIP、JSON）、Web API（File API、Drag & Drop）、非同期データ処理、進捗管理、エラーハンドリング、データ形式変換

**読むタイミング**: Import/Export機能の実装を開始する前、データ移行機能の設計時、既存システムとの連携機能実装時に参照してください。特にSpreadsheetプラグインでCSVインポート機能やExcelエクスポート機能を実装する際は、本計画書の手法を応用することで効率的な実装が可能です。

本計画書は、実証済みの機能を確実に移植し、ユーザビリティの高いデータ操作機能を提供することを目的としています。

## 📌 概要
Eria Cartograph（`references/eria-cartograph/app0/`）の完全実装されたimport/export機能をHierarchiDBに移植するための詳細な実装計画書です。

## 🎯 移植の目標
1. **テンプレートインポート機能**: 事前定義されたデータセットの簡単なインポート
2. **ZIP形式のインポート/エクスポート**: ツリー構造とリソースの完全なバックアップ・復元
3. **進捗管理とエラーハンドリング**: ユーザビリティの高い実装
4. **E2Eテストによる品質保証**: Playwrightテストの移植

## 📊 現状分析

### ✅ HierarchiDBで実装済み
- Worker層: `importNodes`コマンド実装（`TreeMutationServiceImpl`）
- 型定義: `ImportNodesPayload`（`@hierarchidb/core`）
- UI: TreeConsoleToolbarコンポーネント基盤

### ❌ HierarchiDBで未実装
- テンプレート定義とデータファイル
- ZIP/JSONファイル処理サービス
- Orchestrated API統合
- 進捗管理UI
- E2Eテスト

## 🚀 実装フェーズ

### Phase 1: 基盤整備（2-3日）

#### 1.1 ディレクトリ構造の作成
```
packages/
├── app/
│   ├── public/
│   │   └── templates/           # テンプレートデータ格納
│   │       ├── population-2023/
│   │       │   ├── manifest.json
│   │       │   ├── tree-nodes.json
│   │       │   └── resources/
│   │       └── economic-data-2023/
│   └── src/
│       └── features/
│           └── import-export/    # 新規作成
│               ├── components/
│               ├── services/
│               ├── hooks/
│               └── types/
```

#### 1.2 テンプレート定義ファイルの作成
```typescript
// packages/app/public/templates/population-2023/manifest.json
{
  "version": "1.0",
  "name": "Total Population by Country",
  "description": "World population data by country for 2023",
  "icon": "Public",
  "nodeCount": 4,
  "resourceTypes": {
    "_shapes_buggy": 1,
    "stylemaps": 1,
    "tables": 1
  }
}
```

#### 1.3 型定義の追加
```typescript
// packages/core/src/types/import-export.ts
export interface ImportManifest {
  version: string;
  name: string;
  description: string;
  icon?: string;
  nodeCount: number;
  resourceTypes: Record<string, number>;
}

export interface ImportProgress {
  phase: 'reading' | 'validating' | 'importing-nodes' | 'importing-resources' | 'finalizing';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  importedNodeIds: TreeNodeId[];
  skippedNodes: number;
  errors: string[];
}
```

### Phase 2: サービス層実装（3-4日）

#### 2.1 ImportServiceの移植
```typescript
// packages/worker/src/services/ImportService.ts
import JSZip from 'jszip';
import type { ImportManifest, ImportProgress, ImportResult } from '@hierarchidb/core';

export class ImportService {
  constructor(
    private coreDB: CoreDB,
    private mutationService: TreeMutationServiceImpl
  ) {}

  async importFromZip(options: {
    zipFile: File;
    targetParentId: TreeNodeId;
    progressCallback?: (progress: ImportProgress) => void;
  }): Promise<ImportResult> {
    // Eria Cartographからロジック移植
    // 1. ZIPファイル読み込み
    // 2. manifest.json検証
    // 3. tree-nodes.json処理
    // 4. リソースデータ処理
    // 5. ID マッピング
  }

  async importFromTemplate(templateId: string, targetParentId: TreeNodeId): Promise<ImportResult> {
    // テンプレートファイル取得
    const response = await fetch(`/templates/${templateId}/tree-nodes.json`);
    const treeData = await response.json();
    
    // importNodesコマンド実行
    return await this.mutationService.importNodes({
      payload: {
        nodes: treeData.nodes,
        nodeIds: treeData.nodeIds,
        toParentId: targetParentId,
        onNameConflict: 'rename'
      },
      commandId: `import-template-${Date.now()}`,
      groupId: `template-${templateId}`,
      kind: 'importNodes',
      issuedAt: Date.now()
    });
  }
}
```

#### 2.2 ExportServiceの実装
```typescript
// packages/worker/src/services/ExportService.ts
export class ExportService {
  constructor(
    private coreDB: CoreDB,
    private queryService: TreeQueryServiceImpl
  ) {}

  async exportToZip(options: {
    nodeIds: TreeNodeId[];
    includeResources?: boolean;
    progressCallback?: (progress: ExportProgress) => void;
  }): Promise<Blob> {
    const zip = new JSZip();
    
    // manifest.json作成
    const manifest: ExportManifest = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      nodeCount: nodeIds.length,
      // ...
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    
    // tree-nodes.json作成
    const nodes = await this.collectNodes(nodeIds);
    zip.file('tree-nodes.json', JSON.stringify(nodes, null, 2));
    
    // ZIPファイル生成
    return await zip.generateAsync({ type: 'blob' });
  }
}
```

### Phase 3: UI統合（2-3日）

#### 3.1 Orchestrated API拡張
```typescript
// packages/worker/src/WorkerAPIImpl.ts
export class WorkerAPIImpl implements WorkerAPI {
  // 既存のメソッドに追加
  
  async importFromTemplate(params: {
    templateId: string;
    targetParentId: TreeNodeId;
  }): Promise<{ success: boolean; nodeIds?: TreeNodeId[]; error?: string }> {
    try {
      const importService = new ImportService(this.coreDB, this.mutationService);
      const result = await importService.importFromTemplate(
        params.templateId,
        params.targetParentId
      );
      return {
        success: true,
        nodeIds: result.importedNodeIds
      };
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }
}
```

#### 3.2 TreeConsoleToolbar連携
```typescript
// packages/ui-treeconsole/ui-treeconsole-toolbar/src/containers/TreeConsoleToolbar.tsx
const handleAction = (action: string, params?: any) => {
  switch (action) {
    case 'import':
      // テンプレートインポート処理
      if (params?.templateId) {
        api.importFromTemplate({
          templateId: params.templateId,
          targetParentId: treeRootNodeId
        });
      }
      break;
    case 'export':
      // エクスポート処理
      // ...
      break;
  }
};
```

#### 3.3 テンプレート選択UIの実装
```typescript
// packages/app/src/features/import-export/containers/TemplateMenu.tsx
export const IMPORT_TEMPLATES = [
  {
    id: 'population-2023',
    name: 'Total Population by Country',
    icon: PublicIcon,
    description: 'World population data for 2023'
  },
  {
    id: 'economic-data-2023',
    name: 'Economic Indicators',
    icon: TrendingUpIcon,
    description: 'GDP and economic metrics by country'
  }
];
```

### Phase 4: テスト実装（2日）

#### 4.1 E2Eテストの移植
```typescript
// packages/app/e2e/template-import.test.ts
import { test, expect } from '@playwright/test';

test.describe('Template Import', () => {
  test('should import population template', async ({ page }) => {
    // 1. アプリケーション起動
    await page.goto('/t/resources');
    
    // 2. Import/Exportボタンクリック
    await page.getByRole('button', { name: 'Import and export options' }).click();
    
    // 3. Import from Templatesにホバー
    await page.getByRole('menuitem', { name: 'Import from Templates' }).hover();
    
    // 4. Total Population by Countryクリック
    await page.getByRole('menuitem', { name: 'Total Population by Country' }).click();
    
    // 5. インポート完了確認
    await expect(page.getByText('Total Population by Country')).toBeVisible();
  });
});
```

#### 4.2 統合テストの追加
```typescript
// packages/worker/src/__tests__/integration/import-export.test.ts
describe('Import/Export Integration', () => {
  it('should import template data', async () => {
    const api = new WorkerAPIImpl('test-db');
    
    const result = await api.importFromTemplate({
      templateId: 'population-2023',
      targetParentId: 'root' as TreeNodeId
    });
    
    expect(result.success).toBe(true);
    expect(result.nodeIds).toHaveLength(4);
  });
});
```

## 📝 実装タスクリスト

### Week 1（基盤とサービス層）
- [ ] ディレクトリ構造作成
- [ ] テンプレートデータファイル作成
- [ ] 型定義追加（`@hierarchidb/core`）
- [ ] ImportService実装
- [ ] ExportService実装
- [ ] ZIP処理ユーティリティ実装

### Week 2（UI統合とテスト）
- [ ] Orchestrated API拡張
- [ ] TreeConsoleToolbar連携実装
- [ ] ImportDialogコンポーネント作成
- [ ] ExportDialogコンポーネント作成
- [ ] E2Eテスト移植
- [ ] 統合テスト追加

## 🔍 実装の注意点

### 1. アーキテクチャ適合性
- HierarchiDBの4層アーキテクチャを維持
- Worker層での処理を基本とし、UIは薄く保つ
- Comlink RPCを通じた通信パターンの遵守

### 2. 型安全性
- `any`型の使用禁止
- 全ての関数に適切な型注釈
- `unknown`型とtype guardsの活用

### 3. パフォーマンス
- 大量データ処理時の進捗表示
- Virtual Scrollingの活用（100件以上）
- Ring Bufferによるメモリ管理

### 4. エラーハンドリング
- ユーザーフレンドリーなエラーメッセージ
- 部分的な失敗の適切な処理
- ロールバック機能の実装

## 📊 成功指標

1. **機能完全性**: Eria Cartographと同等の機能実現
2. **パフォーマンス**: 1000ノードのインポートが5秒以内
3. **テストカバレッジ**: E2Eテスト100%合格
4. **ユーザビリティ**: エラー率1%未満

## 🚦 リスクと対策

| リスク | 影響度 | 対策 |
|-------|--------|------|
| ZIP処理ライブラリの互換性 | 中 | JSZipの事前検証 |
| 大容量ファイルのメモリ使用 | 高 | ストリーミング処理の実装 |
| ID衝突の処理 | 中 | UUID再生成ロジック |
| テンプレートバージョン管理 | 低 | manifest.jsonでバージョン管理 |

## 📅 スケジュール

- **Week 1**: Phase 1-2（基盤整備、サービス層）
- **Week 2**: Phase 3-4（UI統合、テスト）
- **Week 3**: バグ修正、最適化、ドキュメント作成

---
*この計画書は、Eria Cartographの実装を基にHierarchiDBのアーキテクチャに適合させた移植計画です。*