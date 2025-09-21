# plugins-spreadsheet-plugin TDD要件定義書

## 1. 機能の概要（EARS要件定義書・設計文書ベース）

- 🟢 **機能目的**: plugins-spreadsheet-pluginをモックアップから実際に機能するプラグインに変換する
- 🟢 **問題解決**: ユーザーがCSVデータをツリー構造内で管理・フィルタリング・表示できるように
- 🟢 **想定ユーザー**: HierarchiDBを使用してデータ分析・可視化を行うユーザー
- 🟢 **システム位置づけ**: plugins-folder-pluginの拡張として実装、プラグインシステム内で動作
- 🟢 **継承パターン**: FolderEntityHandlerを継承し、CSV固有機能を追加する拡張プラグイン
- **参照した設計文書**: 
  - `packages/plugins/spreadsheet-plugin/src/extension/definition.ts` (既存モックアップ定義)
  - `packages/plugins/folder-plugin/src/handlers/FolderEntityHandler.ts` (継承元実装)
  - `packages/ui/csv-extract/src/components/*.tsx` (UI仕様)

## 2. 入力・出力の仕様（EARS機能要件・TypeScript型定義ベース）

### 入力パラメータ
- 🟢 **Step1**: FolderEntityと同様の基本情報入力
  - `name: string` - スプレッドシート名
  - `description?: string` - 説明文
- 🟢 **Step2**: CSVFileUploadStep.tsx仕様に基づく
  - `file: File | null` - アップロードファイル
  - `url?: string` - ダウンロードURL
  - `config: CSVProcessingConfig` - CSV処理設定（区切り文字、エンコーディング等）
- 🟢 **Step3**: CSVFilterStep.tsx仕様に基づく
  - `filters: CSVFilterRule[]` - フィルタリングルール配列
- 🟢 **Step4**: CSVColumnSelectionStep.tsx仕様に基づく
  - `mapping: CSVColumnMapping[]` - 列選択・マッピング設定

### 出力値
- 🟢 **SpreadsheetEntity**: FolderEntity + 拡張フィールド
  - `spreadsheetMetadataId?: string` - CSVTableMetadataへの参照ID
  - `dataSource: DataSourceConfig` - データソース設定
  - `filters?: FilterConfig` - フィルタ設定
- 🟢 **CSVTableMetadata**: CSV データのメタ情報
  - `id, filename, totalRows, columns, referenceCount` など

### データフロー
- 🟢 **UI→Worker**: Comlink RPC経由でデータ処理要求
- 🟢 **Worker→Database**: CoreDB/EphemeralDBでの永続化・作業コピー管理
- 🟢 **参照管理**: CSVTableMetadataの参照カウント機能による共有データ管理
- **参照した設計文書**: `packages/ui/csv-extract/src/types/index.ts` (型定義)

## 3. 制約条件（EARS非機能要件・アーキテクチャ設計ベース）

### パフォーマンス要件
- 🟢 **ファイルサイズ制限**: 最大50MB（CSVFileUploadStep.tsxのデフォルト制限）
- 🟢 **プレビュー行数**: 最大100行（境界値テストケースに基づく）
- 🟢 **メモリ使用量**: 大容量ファイルでもブラウザクラッシュを起こさない

### セキュリティ要件  
- 🟢 **ファイル形式検証**: CSV/TSV/Excel形式のみ許可
- 🟢 **URL検証**: ダウンロード時のURL形式バリデーション
- 🟢 **データ隔離**: プラグイン間でのデータ漏洩防止

### アーキテクチャ制約
- 🟢 **継承制約**: plugins-folder-pluginを必ず継承
- 🟢 **UI-Worker分離**: UI層から直接データベースアクセス禁止
- 🟢 **Working Copy**: EphemeralDBでの編集セッション管理
- 🟢 **参照管理**: CSVTableMetadataの参照カウント機能必須

### データベース制約
- 🟢 **Branded ID**: NodeId、EntityId型の厳密な使用
- 🟢 **トランザクション**: 複数テーブル更新の原子性保証
- 🟢 **リレーション管理**: 参照カウント0での自動削除
- **参照した設計文書**: `CLAUDE.md` (アーキテクチャ制約)

## 4. 想定される使用例（EARSEdgeケース・データフローベース）

### 基本的な使用パターン
- 🟢 **新規作成フロー**:
  1. Step1: 基本情報入力（folder継承UI）
  2. Step2: CSVファイルアップロード/URL指定
  3. Step3: フィルタ条件設定（オプション）
  4. Step4: 列選択・マッピング設定
  5. 完了: SpreadsheetEntity作成、CSVTableMetadata参照追加

- 🟢 **編集フロー**:
  1. Working Copy作成
  2. 各Stepでの設定変更
  3. コミット/破棄操作

### データフロー
- 🟢 **アップロード**: File → CSVTableMetadata → SpreadsheetEntity参照
- 🟢 **フィルタリング**: CSVFilterRule → getFilteredPreview → プレビュー表示
- 🟢 **参照管理**: addTableReference/removeTableReference → 自動削除

### エッジケース
- 🟢 **空ファイル**: `throw new Error('No columns found')`
- 🟢 **ヘッダーのみCSV**: `throw new Error('No data rows found')`  
- 🟢 **ネットワークエラー**: `throw new Error('Failed to download: 404 Not Found')`
- 🟢 **無効テーブルID**: `throw new Error('Table not found')`
- **参照したEARS要件**: `docs/implements/styler-csv-api-driver/StylerCSVApiDriver-testcases.md`

### 境界値ケース
- 🟡 **最大ファイルサイズ**: 50MB相当のCSVデータ
- 🟡 **数値極値**: `Number.MAX_SAFE_INTEGER`、`Number.MIN_SAFE_INTEGER`
- 🟡 **長文字列**: 10,000文字のCSVセル
- 🟢 **null値処理**: `null`、`''`、`'   '`、`'0'`、`'false'`の適切な区別

## 5. EARS要件・設計文書との対応関係

### 参照した既存実装
- **継承元プラグイン**: `packages/plugins-plugin/folder/src/` (完全実装)
- **拡張定義**: `packages/plugins-plugin/spreadsheet/src/extension/definition.ts` (モックアップ)
- **UI コンポーネント**: `packages/ui/csv-extract/src/components/` (実装済み)

### 参照した設計文書
- **アーキテクチャ**: `CLAUDE.md` - プラグインシステム、Working Copy パターン
- **データフロー**: UIコンポーネント → Worker → Database の分離アーキテクチャ
- **型定義**: `packages/ui/csv-extract/src/types/index.ts` - 完全なTypeScript型システム
- **テストケース**: `docs/implements/styler-csv-api-driver/StylerCSVApiDriver-testcases.md` - CSV処理仕様

### 参照した機能要件
- **正常系**: CSVファイルアップロード、フィルタリング、参照管理（6項目）
- **異常系**: ファイル形式エラー、ネットワークエラー、データ整合性エラー（4項目）  
- **境界値**: ファイルサイズ、データ型、文字列長、null値処理（4項目）

## 品質判定

✅ **高品質**:
- **要件の曖昧さ**: なし - 既存実装・設計文書に基づく明確な仕様
- **入出力定義**: 完全 - TypeScript型定義で厳密に規定
- **制約条件**: 明確 - アーキテクチャ制約・パフォーマンス制約を具体的に定義
- **実装可能性**: 確実 - 継承元・UI・型定義がすべて実装済み

## 実装方針

1. **Phase1**: FolderEntityHandlerの継承とSpreadsheetEntityHandlerの実装
2. **Phase2**: CSV処理APIの統合（ICSVDataApi実装）
3. **Phase3**: UI統合（csv-extractコンポーネントの組み込み）
4. **Phase4**: テストケース実装（StylerCSVApiDriver-testcases.md準拠）

**次のお勧めステップ**: `/tdd-testcases` でテストケースの洗い出しを行います。