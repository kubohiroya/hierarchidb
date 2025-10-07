# Redフェーズ設計: Spreadsheet拡張定義

## 実装日時
2024-12-26

## テスト設計

### テストファイル構成
```
packages/plugins/spreadsheet-plugin/
├── src/
│   ├── extension/
│   │   ├── definition.ts         # 実装対象（未作成）
│   │   └── definition.test.ts    # テストファイル（作成済み）
│   └── steps/
│       ├── DataSourceStep.tsx    # Step 2（未作成）
│       └── FilteringStep.tsx     # Step 3（未作成）
```

### テストケース実装状況

| テストID | テストケース名 | 信頼性 | 実装状況 |
|---------|--------------|--------|---------|
| TC-101-001 | 拡張定義の基本構造検証 | 🟢 | ✅ |
| TC-101-002 | 拡張ステップの定義検証 | 🟢 | ✅ |
| TC-101-003 | 拡張フィールドの定義検証 | 🟢 | ✅ |
| TC-101-004 | CSVファイルバリデーション | 🟢 | ✅ |
| TC-101-005 | PDFファイル拒否 | 🟢 | ✅ |
| TC-101-006 | dataSource未選択エラー | 🟢 | ✅ |
| TC-101-007 | ファイル未選択エラー | 🟢 | ✅ |
| TC-101-008 | 空フィルタ配列処理 | 🟢 | ✅ |
| TC-101-009 | TSVファイルバリデーション | 🟢 | ✅ |
| TC-101-010 | Excelファイルバリデーション | 🟢 | ✅ |

### 各テストの詳細設計

#### TC-101-001: 拡張定義の基本構造
- **検証項目**:
  - `extends: 'folder'`
  - `nodeType: 'spreadsheet'`
  - `name: 'Spreadsheet'`
  - `displayName: 'スプレッドシート'`
  - `icon: 'table_chart'`
  - `color: '#2196F3'`

#### TC-101-002: 拡張ステップ定義
- **Step 2検証**:
  - stepNumber: 2
  - title: 'データソース選択'
  - component: DataSourceStep
  - validation関数の存在
- **Step 3検証**:
  - stepNumber: 3
  - title: 'フィルタリング'
  - component: FilteringStep
  - dependsOn: [2]
  - isOptional: true

#### TC-101-003: 拡張フィールド定義
- **spreadsheetMetadataId**:
  - type: 'string'
  - required: false
- **dataSource**:
  - type: 'object'
  - required: true
  - schema定義あり
- **filters**:
  - type: 'object'
  - required: false

### バリデーションロジック設計

#### fileFormatルール
```typescript
validate: (value) => {
  if (value.dataSource?.type !== 'file') return true;
  return /\.(csv|tsv|xlsx?)$/i.test(value.file?.name || '');
}
```

#### Step 2バリデーション
```typescript
validate: async (data) => {
  if (!data.dataSource?.type) {
    return { isValid: false, errors: ['データソースを選択してください'] };
  }
  if (data.dataSource.type === 'file' && !data.file) {
    return { isValid: false, errors: ['ファイルを選択してください'] };
  }
  return { isValid: true, errors: [] };
}
```

## コメント設計の意図

### 信頼性レベルコメント
- 🟢: ドキュメント（EXTENDING_FOLDER_PLUGIN.md、implementation-guide.md）に基づく
- 🟡: 一般的なパターンからの妥当な推測
- 🔴: 推測や仮定に基づく（今回は使用なし）

### 日本語コメントの構成
1. **テスト目的**: 何を確認するか
2. **テスト内容**: どのような処理をテストするか
3. **期待される動作**: 正常時の結果
4. **信頼性レベル**: 資料との照合状況

### Given-When-Thenパターン
- **Given（準備）**: テストデータ準備、初期条件設定
- **When（実行）**: 実際の処理実行、処理内容
- **Then（検証）**: 結果検証、期待値確認

## 失敗の確認方法

### 実行コマンド
```bash
cd packages/plugin-loader/spreadsheet-plugin
pnpm test src/extension/definition.test.ts
```

### 期待される失敗パターン
1. **モジュール未発見エラー**:
   - `Cannot find module './definition'`
   - `Cannot find module '../steps/DataSourceStep'`
   - `Cannot find module '../steps/FilteringStep'`

2. **型定義エラー**:
   - ExtendableNodeTypeDefinition型が見つからない可能性
   - プロジェクトのcommon-coreパッケージに依存

## Greenフェーズへの要件

### 最小実装の要件
1. **definition.ts**:
   - SpreadsheetExtensionオブジェクトのエクスポート
   - 基本プロパティの定義
   - extendedStepsの配列定義
   - extendedFieldsの配列定義
   - extendedValidationの実装

2. **DataSourceStep.tsx**:
   - 最小限のReactコンポーネント
   - エクスポートのみで動作確認可能

3. **FilteringStep.tsx**:
   - 最小限のReactコンポーネント
   - エクスポートのみで動作確認可能

### テスト通過の基準
- 10個すべてのテストケースがパス
- 型エラーなし
- ランタイムエラーなし