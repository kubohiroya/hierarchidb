# plugin-stylemap アーキテクチャ設計

## システム概要

🟢 plugin-stylemap は、hierarchidb フレームワークの AOP ノードシステムに準拠したプラグインで、CSV/TSV ファイルからの地理統計データを MapLibre GL JS 互換のスタイルマッピングに変換する機能を提供します。eria-cartograph の実装パターンを継承し、4層アーキテクチャ内で動作します。

## アーキテクチャパターン

### 選択パターン: AOP プラグインアーキテクチャ + 4層データフロー

🟢 **理由**: 
- hierarchidb フレームワークの既存アーキテクチャとの整合性
- eria-cartograph での実証済みパターンの継承
- TypeScript 型安全性の確保
- Worker層による UI ブロッキング防止

### 🟢 4層データフロー構成

```
UI Layer (React/MUI + StyleMap Components)
    ↕ Comlink RPC (StyleMapAPI)
Worker Layer (StyleMapService + StyleMapDB)
    ↕ Dexie Transactions
CoreDB (StyleMapEntity + TableMetadataEntity + RowEntity)
EphemeralDB (WorkingCopy + PreviewState)
```

## コンポーネント構成

### フロントエンド層

🟢 **プラグイン統合**:
- **NodeTypeDefinition**: `StyleMapNodeDefinition` でプラグイン登録
- **React コンポーネント**: ステップ式ダイアログ (`StyleMapDialog`)
- **State管理**: React hooks + Comlink RPC
- **UI フレームワーク**: Material-UI (MUI) v5

🟢 **主要コンポーネント**:
```typescript
// Plugin Registration
const StyleMapNodeDefinition: NodeTypeDefinition = {
  nodeType: 'stylemap',
  database: { entityStore: 'styleMapEntities', schema: StyleMapEntity },
  entityHandler: new StyleMapEntityHandler(),
  lifecycle: { afterCreate, beforeDelete },
  ui: { 
    dialogComponent: StyleMapDialog,
    panelComponent: StyleMapPreviewPanel 
  }
};
```

### Worker層

🟢 **データ処理サービス**:
- **StyleMapService**: ファイル処理・カラーマッピング計算
- **StyleMapDB**: IndexedDB 永続化層 (Dexie ベース)
- **StyleMapFileCacheService**: SHA3 ハッシュベースキャッシュ管理
- **Working Copy管理**: EphemeralDB での編集状態管理

🟢 **Comlink RPC インターフェース**:
```typescript
interface StyleMapWorkerAPI {
  parseFile(file: File): Promise<ParseResult>;
  calculateStyleMapping(config: StyleMapConfig, data: RowEntity[]): Promise<StyleProperty[]>;
  saveStyleMap(entity: StyleMapEntity): Promise<void>;
  getStyleMap(nodeId: string): Promise<StyleMapEntity | undefined>;
}
```

### データベース層

🟢 **CoreDB スキーマ** (Dexie/IndexedDB):
- **styleMapEntities**: StyleMapEntity の永続化
- **tableMetadataEntities**: CSV/TSV メタデータ
- **rowEntities**: 表データの行情報

🟢 **EphemeralDB スキーマ**:
- **workingCopies**: 編集中のStyleMapEntity
- **previewStates**: リアルタイムプレビュー状態
- **undoRedoBuffer**: 操作履歴の管理

### 外部連携層

🟢 **MapLibre GL JS 連携**:
- **StyleProperty生成**: MapLibre仕様準拠のスタイル出力
- **対応プロパティ**: fill-color, line-width, circle-radius など12種類
- **カラーアルゴリズム**: linear, logarithmic, quantile, categorical

🟡 **ファイル処理**:
- **Parser**: RFC 4180 準拠 CSV/TSV パーサー
- **Cache**: SHA3-256 ハッシュベースファイルキャッシュ
- **Validation**: XSS 防止・ファイル形式検証

## 設計原則とパターン

### 🟢 Working Copy パターン

**目的**: 安全な編集機能とアンドゥ/リドゥサポート

**フロー**:
1. **作業コピー作成**: CoreDB → EphemeralDB
2. **編集**: EphemeralDB内で変更適用
3. **プレビュー**: リアルタイム表示更新
4. **コミット/破棄**: CoreDB反映 or EphemeralDB削除

**実装**:
```typescript
// 🟢 Working Copy Lifecycle
class StyleMapEntityHandler {
  async createWorkingCopy(nodeId: string): Promise<StyleMapWorkingCopy> {
    const original = await this.coreDB.getEntity(nodeId);
    const workingCopy = { ...original, isWorkingCopy: true };
    await this.ephemeralDB.saveWorkingCopy(workingCopy);
    return workingCopy;
  }

  async commitWorkingCopy(nodeId: string): Promise<void> {
    const workingCopy = await this.ephemeralDB.getWorkingCopy(nodeId);
    await this.coreDB.saveEntity({ ...workingCopy, isWorkingCopy: false });
    await this.ephemeralDB.deleteWorkingCopy(nodeId);
  }
}
```

### 🟢 データ正規化パターン

**目的**: 重複ファイル格納の防止とストレージ効率化

**設計**:
- **TableMetadataEntity**: ファイルハッシュによる一意識別
- **参照カウント**: 複数StyleMapからの共有データ管理
- **RowEntity**: 正規化された行データ格納

### 🟡 キャッシュ戦略

**目的**: 大容量ファイルのパフォーマンス最適化

**実装**:
- **Cache API**: ブラウザ標準キャッシュ活用
- **SHA3-256**: コンテンツベース一意識別
- **有効期限**: 24時間での自動削除
- **参照管理**: LRU による容量制御

## セキュリティ設計

### 🟡 入力検証・サニタイゼーション

**XSS防止**:
- **ファイル内容**: HTML タグ・スクリプトのエスケープ処理
- **ユーザー入力**: カラム名・フィルタ値の検証
- **URL検証**: downloadUrl の安全性確認

**ファイル検証**:
```typescript
// 🟡 File Validation
class FileValidator {
  validateFileType(file: File): boolean {
    const allowedTypes = ['text/csv', 'text/tab-separated-values'];
    const allowedExtensions = ['.csv', '.tsv'];
    return allowedTypes.includes(file.type) || 
           allowedExtensions.some(ext => file.name.endsWith(ext));
  }

  sanitizeContent(content: string): string {
    return content.replace(/<script[^>]*>.*?<\/script>/gi, '')
                  .replace(/<[^>]*>/g, '');
  }
}
```

### 🟢 ログ・監査

**機密情報保護**:
- **ファイル内容**: 平文ログ出力禁止
- **個人識別情報**: 自動マスキング
- **エラーハンドリング**: スタックトレースでの情報漏洩防止

## パフォーマンス設計

### 🟡 ファイル処理最適化

**大容量ファイル対応**:
- **ストリーミング処理**: メモリ効率的なCSVパース
- **Worker並列化**: バックグラウンド処理によるUI応答性維持
- **プログレス表示**: 処理進捗のリアルタイム表示

**処理時間目標**:
- 10万行以下: 5秒以内
- 5万行以下: 2.5秒以内
- 1万行以下: 1秒以内

### 🟡 UI応答性最適化

**リアルタイムプレビュー**:
- **Debounce**: 300ms での入力イベント制御
- **Virtual DOM**: React最適化パターン
- **Memoization**: 重い計算結果のキャッシュ

```typescript
// 🟡 Performance Optimization
const StyleMapPreview = memo(({ config, data }: Props) => {
  const debouncedConfig = useDebounce(config, 300);
  
  const calculatedStyles = useMemo(() => 
    calculateStyleMapping(debouncedConfig, data),
    [debouncedConfig, data]
  );

  return <PreviewComponent styles={calculatedStyles} />;
});
```

## エラーハンドリング設計

### 🟢 階層化エラー処理

**UI層**:
- **ユーザーフレンドリーメッセージ**: 技術用語を避けた説明
- **リカバリガイダンス**: 具体的な解決手順の提示
- **状態復旧**: 可能な限りの編集状態保持

**Worker層**:
- **エラー分類**: FileError, ValidationError, DatabaseError
- **自動リトライ**: 一時的エラーでの自動復旧
- **フォールバック**: 機能縮退での継続動作

**データベース層**:
- **トランザクション回復**: ロールバック機能
- **整合性チェック**: データ破損検出・修復
- **バックアップ**: 重要データの自動バックアップ

### 🟡 境界値・Edgeケース対応

**ファイル処理**:
- **空ファイル**: 適切なエラーメッセージと代替案提示
- **巨大ファイル**: 段階的警告とストリーミング処理
- **文字エンコーディング**: UTF-8以外での自動変換試行

**データ処理**:
- **欠損値**: NULL・空文字列の適切な処理
- **数値範囲**: 極端な値での計算精度保証
- **カラム不一致**: 動的スキーマ調整

## 拡張性設計

### 🟡 プラグイン拡張ポイント

**カラーアルゴリズム**:
- **Strategy パターン**: 新規アルゴリズムの追加インターフェース
- **動的ロード**: 実行時でのアルゴリズム登録
- **設定保存**: カスタムアルゴリズムの永続化

**ファイル形式**:
- **Parser インターフェース**: 新規フォーマット対応
- **MIME タイプ拡張**: 自動判定機能の拡張
- **変換パイプライン**: 多段階データ変換

### 🟡 将来対応予定機能

**高度なフィルタリング**:
- **SQL風クエリ**: WHERE句相当の複雑条件
- **正規表現拡張**: より高度なパターンマッチング
- **地理空間フィルタ**: 座標範囲での絞り込み

**データ連携**:
- **外部データソース**: REST API経由でのデータ取得
- **リアルタイム更新**: WebSocket経由での動的データ更新
- **データ結合**: 複数ソースでの JOIN 操作

## テスト設計

### 🟡 テスト戦略

**ユニットテスト (Jest)**:
- **Entity処理**: CRUD操作の完全性確認
- **カラーマッピング**: アルゴリズム計算精度検証
- **ファイルパース**: 各種CSVフォーマットでの動作確認

**E2E テスト (Playwright)**:
- **完全フロー**: ファイルアップロード→設定→保存の全工程
- **エラーシナリオ**: 異常系での適切な処理確認
- **パフォーマンス**: 大容量データでの応答時間測定

**統合テスト**:
- **プラグイン統合**: hierarchidb コアとの連携確認
- **Worker通信**: Comlink RPC での型安全性確認
- **データベース**: 複数ブラウザタブでの競合制御

## 運用設計

### 🟡 監視・メトリクス

**パフォーマンス監視**:
- **ファイル処理時間**: サイズ別ベンチマーク
- **メモリ使用量**: 大容量データでのリーク検出
- **キャッシュ効率**: ヒット率・容量使用率

**エラー監視**:
- **エラー発生率**: 機能別・原因別分類
- **ユーザー影響**: 失敗したタスクの分析
- **回復率**: 自動復旧・手動復旧の成功率

### 🟡 保守・アップデート

**データマイグレーション**:
- **スキーマ変更**: 後方互換性を保持した段階的更新
- **データ変換**: 既存StyleMapEntityの自動移行
- **ロールバック**: 問題発生時の安全な巻き戻し

**設定管理**:
- **デフォルト値**: 新機能での既存データへの影響最小化
- **互換性マトリックス**: MapLibre GL JSバージョン対応表
- **非推奨機能**: 段階的廃止スケジュール

## 技術スタック

### 🟢 必須依存関係

**Core Framework**:
- TypeScript 5.x (strict mode)
- React 19.x
- Material-UI (MUI) 5.x
- Dexie 3.x (IndexedDB wrapper)

**Data Processing**:
- Comlink (Worker RPC)
- SHA3.js (ハッシュ計算)
- CSV Parser (RFC 4180準拠)

**Map Integration**:
- MapLibre GL JS 3.x
- Color conversion utilities

### 🟡 開発・テスト環境

**Development**:
- Vite (ビルドツール)
- ESLint + Prettier (コード品質)
- Storybook (コンポーネント開発)

**Testing**:
- Jest (ユニットテスト)
- @testing-library/react (React テスト)
- Playwright (E2E テスト)
- Chrome DevTools (パフォーマンス測定)

この設計により、eria-cartograph の実証済みパターンを継承しつつ、hierarchidb フレームワークの特性を活かした堅牢で拡張性の高い plugin-stylemap を実現します。