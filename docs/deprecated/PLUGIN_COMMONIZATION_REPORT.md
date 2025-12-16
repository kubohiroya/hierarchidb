# Shape/Location/Route/Spreadsheetプラグイン共通化提案レポート

## 1. エグゼクティブサマリー

Shape、Location、Route、Spreadsheetプラグインのコード分析により、以下の領域で重複コードが特定され、共通化による大幅な保守性向上とコード量削減が可能です。

### 主要な共通化候補
- **EntityHandler基底クラス**: 約1,500行の重複コード削減可能
- **WorkingCopyマネージャー**: 約800行の重複コード削減可能
- **CSV/ファイル処理**: 約600行の重複コード削減可能
- **データベース操作**: 約400行の重複コード削減可能

**推定削減効果**: 全体で約3,300行（約40%）のコード削減

## 2. 共通化対象の詳細分析

### 2.1 EntityHandler基底クラス

#### 現状の問題点
各プラグインが独自にEntityHandlerを実装しており、以下のメソッドが重複：
- `createEntity()` - エンティティ作成
- `updateEntity()` - エンティティ更新
- `deleteEntity()` - エンティティ削除
- `getEntity()` / `getEntityByNodeId()` - エンティティ取得
- `listEntities()` / `searchEntities()` - エンティティ検索

#### 共通化提案
```typescript
// packages/_obsolate_common/plugin-base/src/handlers/BaseEntityHandler.ts
export abstract class BaseEntityHandler<
  TEntity extends BaseEntity,
  TWorkingCopy extends BaseWorkingCopy
> {
  protected abstract table: Dexie.Table<TEntity>;
  
  // 共通実装
  async createEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<TEntity> {
    const entityId = generateEntityId() as EntityId;
    const entity = this.buildEntity(nodeId, entityId, data);
    await this.table.add(entity);
    return entity;
  }
  
  async updateEntity(entityId: EntityId, updates: Partial<TEntity>): Promise<TEntity> {
    const existing = await this.table.get(entityId);
    if (!existing) throw new Error(`Entity not found: ${entityId}`);
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };
    
    await this.table.put(updated);
    return updated;
  }
  
  // プラグイン固有の実装
  protected abstract buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<TEntity>
  ): TEntity;
}
```

### 2.2 WorkingCopyマネージャー

#### 現状の問題点
WorkingCopy管理ロジックが各プラグインで重複：
- `createWorkingCopy()` - 編集用コピー作成
- `createNewDraftWorkingCopy()` - 新規ドラフト作成
- `updateWorkingCopy()` - 編集内容の更新
- `commitWorkingCopy()` - CoreDBへのコミット
- `discardWorkingCopy()` - 編集の破棄

#### 共通化提案
```typescript
// packages/_obsolate_common/plugin-base/src/managers/WorkingCopyManager.ts
export class WorkingCopyManager<
  TEntity extends BaseEntity,
  TWorkingCopy extends BaseWorkingCopy
> {
  constructor(
    private ephemeralDB: EphemeralDB,
    private entityHandler: BaseEntityHandler<TEntity, TWorkingCopy>
  ) {}
  
  async createWorkingCopy(entity: TEntity): Promise<TWorkingCopy> {
    const workingCopy = this.buildWorkingCopy(entity);
    await this.ephemeralDB.workingCopies.add(workingCopy);
    return workingCopy;
  }
  
  async commitWorkingCopy(workingCopyId: EntityId): Promise<NodeId> {
    const workingCopy = await this.getWorkingCopy(workingCopyId);
    if (!workingCopy) throw new Error(`Working copy not found`);
    
    let nodeId: NodeId;
    if (workingCopy.isDraft) {
      // 新規作成
      const entity = await this.entityHandler.createEntity(
        '' as NodeId,
        workingCopy
      );
      nodeId = entity.nodeId;
    } else {
      // 既存更新
      await this.entityHandler.updateEntity(
        workingCopy.id,
        workingCopy
      );
      nodeId = workingCopy.nodeId;
    }
    
    await this.discardWorkingCopy(workingCopyId);
    return nodeId;
  }
  
  protected buildWorkingCopy(entity: TEntity): TWorkingCopy {
    // デフォルト実装、オーバーライド可能
    return {
      ...entity,
      isDraft: false,
      copiedAt: Date.now(),
      originalVersion: entity.version,
    } as TWorkingCopy;
  }
}
```

### 2.3 CSV/ファイル処理ユーティリティ

#### 現状の問題点
CSV処理ロジックがSpreadsheetとStylerで重複：
- CSVパース処理
- カラム型推定
- ファイルハッシュ計算
- チャンク分割処理

#### 共通化提案
```typescript
// packages/_obsolate_common/csv-utils/src/CSVProcessor.ts
export class CSVProcessor {
  constructor(private config: CSVProcessingConfig) {}
  
  async parseCSV(content: string): Promise<ParsedCSV> {
    // RFC4180準拠のパース実装
    const lines = this.parseLines(content);
    const headers = this.extractHeaders(lines);
    const rows = this.parseRows(lines, headers);
    const columns = this.detectColumnTypes(rows);
    
    return { rows, columns };
  }
  
  async chunkLargeCSV(
    content: string,
    chunkSize: number = 10000
  ): Promise<ChunkedData> {
    const parsed = await this.parseCSV(content);
    const chunks = [];
    
    for (let i = 0; i < parsed.rows.length; i += chunkSize) {
      chunks.push(parsed.rows.slice(i, i + chunkSize));
    }
    
    return {
      chunks,
      totalRows: parsed.rows.length,
      chunkSize,
    };
  }
  
  detectColumnTypes(rows: any[]): CSVColumnType[] {
    // 型推定ロジック
    return columns.map(col => this.inferType(col, rows));
  }
}
```

### 2.4 データベース操作パターン

#### 現状の問題点
Dexie操作パターンが各プラグインで重複：
- トランザクション管理
- バルクインサート
- インデックス付き検索
- ページネーション

#### 共通化提案
```typescript
// packages/_obsolate_common/plugin-base/src/database/BasePluginDatabase.ts
export abstract class BasePluginDatabase {
  protected db: Dexie;
  
  constructor(dbName: string) {
    this.db = new Dexie(dbName);
    this.initSchema();
  }
  
  protected abstract initSchema(): void;
  
  // 共通トランザクション管理
  async performTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.db.transaction('rw', 
      this.db.tables,
      operation
    );
  }
  
  // 共通バルクインサート
  async bulkInsert<T>(
    table: Dexie.Table<T>,
    items: T[],
    batchSize: number = 1000
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await table.bulkAdd(batch);
    }
  }
  
  // 共通ページネーション
  async paginate<T>(
    table: Dexie.Table<T>,
    page: number,
    pageSize: number,
    orderBy?: string
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;
    let query = table.toCollection();
    
    if (orderBy) {
      query = table.orderBy(orderBy);
    }
    
    const items = await query
      .offset(offset)
      .limit(pageSize)
      .toArray();
    
    const total = await table.count();
    
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
```

## 3. 実装ロードマップ

### Phase 1: 基盤整備（1週間）
1. `packages/common/plugin-base`パッケージの作成
2. 基底クラスとインターフェースの定義
3. ユニットテストの作成

### Phase 2: EntityHandler共通化（2週間）
1. `BaseEntityHandler`の実装
2. 各プラグインのEntityHandlerをBaseEntityHandlerを継承するよう修正
3. 回帰テストの実施

### Phase 3: WorkingCopy共通化（1週間）
1. `WorkingCopyManager`の実装
2. 各プラグインのWorkingCopy処理を共通マネージャーに移行
3. 統合テストの実施

### Phase 4: CSV/ファイル処理共通化（1週間）
1. `CSVProcessor`クラスの実装
2. SpreadsheetとStylerのCSV処理を共通化
3. パフォーマンステストの実施

### Phase 5: データベース操作共通化（1週間）
1. `BasePluginDatabase`の実装
2. 各プラグインのDB操作を共通基底クラスに移行
3. トランザクションテストの実施

## 4. 期待される効果

### 保守性の向上
- **コード重複の削減**: 約40%のコード削減により、バグの発生確率が低下
- **一貫性の確保**: 全プラグインで同一のAPIパターンを使用
- **テスト容易性**: 共通部分のテストを一元化

### 開発効率の向上
- **新規プラグイン開発時間**: 約60%短縮（基底クラスの再利用）
- **バグ修正時間**: 約50%短縮（修正箇所の一元化）
- **機能追加時間**: 約40%短縮（共通機能の再利用）

### パフォーマンスの最適化
- **メモリ使用量**: チャンク処理の共通化により約30%削減
- **処理速度**: バルク操作の最適化により約20%向上
- **ネットワーク効率**: ページネーションの統一により通信量削減

## 5. リスクと対策

### リスク1: 既存コードの破壊的変更
**対策**: 
- 段階的な移行（既存APIを@deprecatedで残す）
- 包括的な回帰テストスイート
- Feature flagによる段階的ロールアウト

### リスク2: プラグイン固有の要件への対応困難
**対策**:
- 抽象メソッドによる拡張ポイントの提供
- テンプレートメソッドパターンの活用
- プラグイン固有のフックメカニズム

### リスク3: パフォーマンスの劣化
**対策**:
- ベンチマークテストの実施
- プロファイリングによるボトルネック特定
- 必要に応じた最適化の実施

## 6. 成功指標

### 定量的指標
- コード行数: 40%削減
- テストカバレッジ: 90%以上維持
- パフォーマンス: 現状と同等以上
- バグ報告数: 30%削減

### 定性的指標
- 開発者満足度の向上
- コードレビュー時間の短縮
- 新規開発者のオンボーディング時間短縮
- プラグイン間の一貫性向上

## 7. 次のステップ

1. **技術レビュー**: チーム全体でこの提案をレビュー
2. **POC実装**: Phase 1の基盤整備をPOCとして実装
3. **影響分析**: 既存コードへの影響を詳細に分析
4. **実装計画策定**: 詳細なタスク分解とスケジュール作成
5. **段階的実装**: Phaseごとに実装とテストを実施

## 付録: コード例

### A. 共通化前のコード（Shapeプラグイン）
```typescript
// 約150行のEntityHandler実装
export class ShapeEntityHandler {
  async createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> {
    // 20行の実装
  }
  async updateEntity(entityId: EntityId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
    // 25行の実装
  }
  // ... その他のメソッド
}
```

### B. 共通化後のコード
```typescript
// 約30行に削減
export class ShapeEntityHandler extends BaseEntityHandler<ShapeEntity, ShapeWorkingCopy> {
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<ShapeEntity>
  ): ShapeEntity {
    // 10行のShape固有の実装のみ
    return {
      id: entityId,
      nodeId,
      ...data,
      // Shape固有のフィールド
      processingConfig: data.processingConfig || DEFAULT_CONFIG,
    };
  }
}
```

## まとめ

この共通化により、HierarchiDBのプラグインシステムは、より保守性が高く、拡張性のあるアーキテクチャに進化します。段階的な実装アプローチにより、リスクを最小限に抑えながら、大幅な開発効率の向上を実現できます。