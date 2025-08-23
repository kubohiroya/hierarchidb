# Spreadsheet Plugin エンティティ設計（最終版）

## 用語の統一

- ✅ **Spreadsheet** - 表データ全般を指す用語として統一
- ❌ ~~TableMetadata~~ - HTMLのtableと紛らわしいため使用しない

## エンティティ構造

### 1. SpreadsheetMetadata extends PersistentRelationalEntity

```typescript
import { PersistentRelationalEntity } from '@hierarchidb/core';

// ブランド型
type SpreadsheetMetadataId = string & { readonly __brand: 'SpreadsheetMetadataId' };

/**
 * Spreadsheetのメタデータ（共有可能なデータ本体）
 * PersistentRelationalEntityを継承
 * nodeIdは含まない！
 */
interface SpreadsheetMetadata extends PersistentRelationalEntity {
  // 識別子（UUID）
  id: SpreadsheetMetadataId;
  
  // メタ情報
  name: string;                // ファイル名または表の名前
  description?: string;        // 表の説明
  
  // コンテンツ識別
  contentHash: string;         // SHA-256ハッシュ（重複検出用）
  
  // スプレッドシート情報
  columns: string[];           // カラム名リスト
  rowCount: number;            // 総行数
  columnCount: number;         // 総カラム数
  fileSize: number;            // 元ファイルサイズ
  
  // フォーマット情報
  originalFormat: 'csv' | 'tsv' | 'excel' | 'json';
  delimiter: string;           // 区切り文字（デフォルト: '	'）
  hasHeader: boolean;          // ヘッダー行の有無
  encoding: string;            // 文字エンコーディング
  
  // 統計情報
  stats?: {
    numericColumns: string[];  // 数値型のカラム
    dateColumns: string[];     // 日付型のカラム
    textColumns: string[];     // テキスト型のカラム
  };
  
  // タイムスタンプ（nodeIdは含まない！）
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}
```

### 2. SpreadsheetChunks（データ本体）

```typescript
/**
 * Spreadsheetの実データ（チャンク分割・圧縮済み）
 */
interface SpreadsheetChunk {
  id: string;                           // チャンクID
  metadataId: SpreadsheetMetadataId;    // メタデータへの参照
  chunkIndex: number;                   // チャンク番号
  compressedData: Uint8Array;          // 圧縮データ（pako）
  rowStart: number;                     // 開始行番号
  rowEnd: number;                       // 終了行番号
  sizeBytes: number;                    // 圧縮後サイズ
  firstRowPreview?: string;             // デバッグ用プレビュー
}
```

### 3. SpreadsheetRefEntity extends PersistentPeerEntity

```typescript
import { PersistentPeerEntity, NodeId } from '@hierarchidb/core';

/**
 * ノードとSpreadsheetMetadataの紐付け
 * PersistentPeerEntityを継承
 * 名前や説明はTreeNodeとSpreadsheetMetadataが持つ
 */
interface SpreadsheetRefEntity extends PersistentPeerEntity {
  // 紐付けのみ
  nodeId: NodeId;                       // プライマリキー（TreeNodeへの参照）
  metadataId: SpreadsheetMetadataId;    // SpreadsheetMetadataへの参照
  
  // タイムスタンプ
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### 4. StyleMapEntity extends SpreadsheetRefEntity

```typescript
/**
 * StyleMap用の拡張エンティティ
 * SpreadsheetRefEntityを継承して、StyleMap固有の設定を追加
 * 名前や説明はTreeNodeが持つ
 */
interface StyleMapEntity extends SpreadsheetRefEntity {
  // SpreadsheetRefEntityから継承
  // - nodeId: NodeId
  // - metadataId: SpreadsheetMetadataId
  
  // === StyleMap固有の永続化設定 ===
  
  // フィルタ設定
  filterRules: FilterRule[];             // 行フィルタルール
  filterEnabled: boolean;                // フィルタ有効/無効
  
  // カラムマッピング
  keyColumn: string;                     // キーとなるカラム
  valueColumns: string[];                // 値となるカラム
  selectedColumns?: string[];            // 表示用カラム
  
  // 色設定
  colorScheme: 'categorical' | 'gradient' | 'custom';
  colorConfig: {
    colors?: string[];                   // カテゴリカラー用
    startColor?: string;                 // グラデーション開始色
    endColor?: string;                   // グラデーション終了色
    steps?: number;                      // グラデーションステップ数
    nullColor?: string;                  // NULL値の色
  };
  colorMapping: Record<string, string>;  // 生成された色マッピング
  
  // スタイル設定
  styleConfig: {
    opacity: number;                     // 透明度（0-1）
    layerType: 'fill' | 'line' | 'circle';
    strokeWidth?: number;
    strokeColor?: string;
  };
  
  // キャッシュ（オプション）
  generatedStyle?: string;              // 生成済みMapLibreスタイル（JSON）
  generatedAt?: number;                 // スタイル生成日時
  styleVersion?: number;                // スタイルバージョン
  
  // タイムスタンプ（継承を上書き）
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

### 5. リファレンスカウント管理（Worker側で実装）

```typescript
/**
 * リファレンスカウント管理はWorker側の責務
 * RelationalEntityHandlerが自動的に管理
 */

// Worker側のRelationalEntityHandlerが以下を管理：
// 1. SpreadsheetRefEntityの作成時に自動的にカウントアップ
// 2. SpreadsheetRefEntityの削除時に自動的にカウントダウン
// 3. カウントが0になったらSpreadsheetMetadataとChunksを自動削除

// プラグイン側では以下のAPIを使用するだけ：
interface SpreadsheetPluginAPI {
  // RefEntityを作成（Worker側でカウント管理）
  async createReference(
    nodeId: NodeId,
    metadataId: SpreadsheetMetadataId
  ): Promise<void>;
  
  // RefEntityを削除（Worker側でカウント管理）
  async deleteReference(nodeId: NodeId): Promise<void>;
  
  // 共有状態を確認（読み取り専用）
  async isShared(metadataId: SpreadsheetMetadataId): Promise<boolean>;
}
```

## データベーススキーマ

```typescript
// Dexie schema定義
const schema = {
  // PersistentRelationalEntity（共有データ）
  spreadsheet_metadata: '&id, contentHash, createdAt, lastAccessedAt',
  spreadsheet_chunks: 'id, metadataId, [metadataId+chunkIndex]',
  spreadsheet_ref_counts: '&metadataId, count, lastAccessed',
  
  // PersistentPeerEntity（ノード紐付け）
  spreadsheet_refs: '&nodeId, metadataId, updatedAt',
  stylemap_entities: '&nodeId, metadataId, keyColumn, updatedAt',
  
  // EphemeralRelationalEntity（一時キャッシュ）
  filter_cache: 'id, metadataId, [metadataId+filterHash], expiresAt',
  column_indexes: 'id, [metadataId+column], metadataId',
  
  // EphemeralPeerEntity（一時状態）
  spreadsheet_working_copies: '&nodeId, isDirty, updatedAt',
  spreadsheet_view_states: '&nodeId'
};
```

## 実装例

### CSVインポート

```typescript
class SpreadsheetImporter {
  async import(nodeId: NodeId, file: File): Promise<void> {
    // 1. ファイルを解析
    const { data, headers, contentHash } = await this.parseFile(file);
    
    // 2. 既存のメタデータを検索（contentHashで重複チェック）
    let metadata = await this.findByContentHash(contentHash);
    
    if (!metadata) {
      // 3. 新規作成: SpreadsheetMetadata（nodeIdは含まない！）
      const metadataId = generateUUID() as SpreadsheetMetadataId;
      metadata = {
        id: metadataId,
        contentHash,
        columns: headers,
        rowCount: data.length,
        columnCount: headers.length,
        fileSize: file.size,
        originalFormat: 'csv',
        delimiter: '\t',
        hasHeader: true,
        encoding: 'utf-8',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      
      await this.saveMetadata(metadata);
      await this.saveChunks(metadataId, data);
    }
    
    // 4. SpreadsheetRefEntityを作成（ノードとの紐付け）
    const refEntity: SpreadsheetRefEntity = {
      nodeId,
      metadataId: metadata.id,
      name: file.name,
      description: `Imported from ${file.name}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.saveRefEntity(refEntity);
    
    // 5. リファレンスカウントを更新
    await this.incrementReferenceCount(metadata.id, nodeId);
  }
}
```

### StyleMap作成

```typescript
class StyleMapCreator {
  async create(
    nodeId: NodeId,
    spreadsheetNodeId: NodeId,
    config: StyleMapConfig
  ): Promise<void> {
    // 1. SpreadsheetRefEntityを取得
    const spreadsheetRef = await this.getSpreadsheetRef(spreadsheetNodeId);
    if (!spreadsheetRef) throw new Error('Spreadsheet not found');
    
    // 2. StyleMapEntityを作成（SpreadsheetRefEntityを拡張）
    const styleMapEntity: StyleMapEntity = {
      // 基本プロパティ
      nodeId,
      metadataId: spreadsheetRef.metadataId,  // 同じSpreadsheetを参照
      name: config.name,
      description: config.description,
      
      // StyleMap固有プロパティ
      filterRules: config.filterRules || [],
      filterEnabled: true,
      keyColumn: config.keyColumn,
      valueColumns: config.valueColumns,
      colorScheme: config.colorScheme,
      colorConfig: config.colorConfig,
      colorMapping: await this.generateColorMapping(
        spreadsheetRef.metadataId,
        config.keyColumn,
        config.colorScheme
      ),
      styleConfig: {
        opacity: 0.8,
        layerType: 'fill'
      },
      
      // タイムスタンプ
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.saveStyleMapEntity(styleMapEntity);
    
    // 3. リファレンスカウントを更新（同じSpreadsheetを参照）
    await this.incrementReferenceCount(spreadsheetRef.metadataId, nodeId);
  }
}
```

## 重要な設計原則

### ✅ 正しい実装

1. **SpreadsheetMetadataにnodeIdを含めない**
   ```typescript
   interface SpreadsheetMetadata extends PersistentRelationalEntity {
     id: SpreadsheetMetadataId;  // ✅
     // nodeId: NodeId;          // ❌ 含めない！
   }
   ```

2. **PeerEntityで紐付け**
   ```typescript
   interface SpreadsheetRefEntity extends PersistentPeerEntity {
     nodeId: NodeId;              // ✅ ここで紐付け
     metadataId: SpreadsheetMetadataId;  // ✅ 参照
   }
   ```

3. **拡張はPeerEntityで**
   ```typescript
   interface StyleMapEntity extends SpreadsheetRefEntity {
     // SpreadsheetRefEntityを継承
     filterRules: FilterRule[];   // ✅ 拡張プロパティ
   }
   ```

### ❌ 避けるべき実装

1. **RelationalEntityに直接nodeId**
   ```typescript
   // ❌ これは間違い
   interface SpreadsheetMetadata {
     nodeId: NodeId;  // RelationalEntityが直接持つのはNG
   }
   ```

2. **不適切な継承**
   ```typescript
   // ❌ これも間違い
   interface StyleMapEntity extends SpreadsheetMetadata {
     // RelationalEntityを直接継承はNG
   }
   ```

## まとめ

- **SpreadsheetMetadata** = データ本体（nodeIdなし）
- **SpreadsheetRefEntity** = ノード紐付け（nodeIdあり）
- **StyleMapEntity** = 拡張設定（SpreadsheetRefEntityを継承）

この設計により、データの共有と独立性を保ちながら、適切なライフサイクル管理を実現します。