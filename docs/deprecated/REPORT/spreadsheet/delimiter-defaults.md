# 区切り文字のデフォルト値について

## デフォルト値の設定

Spreadsheet Pluginでは、データソースに応じて以下のデフォルト区切り文字を使用します：

### 1. クリップボード（コピー&ペースト）
```typescript
delimiter: '\t'  // タブ文字
```
- Excel、Google Sheets、Numbers等からのコピー時は自動的にタブ区切りになる
- 最も一般的なユースケース

### 2. CSVファイル（.csv）
```typescript
delimiter: ','  // カンマ
```
- CSVファイルの標準的な区切り文字
- ファイル拡張子が`.csv`の場合は自動検出

### 3. TSVファイル（.tsv）
```typescript
delimiter: '\t'  // タブ文字
```
- TSVファイルの標準的な区切り文字
- ファイル拡張子が`.tsv`の場合は自動検出

### 4. Excelファイル（.xlsx, .xls）
```typescript
// 区切り文字は不要（セル単位で処理）
```
- SheetJSライブラリが自動的に処理
- 区切り文字の概念なし

## 使用例

### クリップボードからのインポート（デフォルト）
```typescript
// Excelからコピーしたデータ
await spreadsheet.import(nodeId, {
  source: 'clipboard',
  clipboardData: clipboardText,
  // delimiter は省略可能（デフォルトで '\t'）
});
```

### CSVファイルのインポート（明示的に指定）
```typescript
// カンマ区切りのCSVファイル
await spreadsheet.import(nodeId, {
  source: 'file',
  file: csvFile,
  delimiter: ',',  // 明示的に指定
});
```

### 自動検出
```typescript
// ファイル拡張子から自動判定
await spreadsheet.import(nodeId, {
  source: 'file',
  file: file,  // .csv → ',', .tsv → '\t'
  // delimiter は省略（自動検出）
});
```

## 区切り文字の優先順位

1. **明示的な指定** - `options.delimiter`
2. **ファイル拡張子による判定**
   - `.csv` → `,`
   - `.tsv` → `\t`
   - `.txt` → `\t`（デフォルト）
3. **ソースタイプによるデフォルト**
   - `clipboard` → `\t`
   - `url` → `\t`
   - その他 → `\t`

## 実装コード

```typescript
function getDefaultDelimiter(source: ImportSource, filename?: string): string {
  // ファイル拡張子から判定
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
        return ',';
      case 'tsv':
      case 'txt':
        return '\t';
    }
  }
  
  // ソースタイプから判定
  switch (source) {
    case 'clipboard':
      return '\t';  // Excel等からのコピペを想定
    case 'file':
      return ',';   // CSVファイルを想定
    case 'url':
      return '\t';  // 汎用的なタブ区切り
    default:
      return '\t';
  }
}
```

## 注意事項

### 日本語環境での考慮事項
- Shift-JISエンコーディングのCSVファイルに注意
- 全角スペースが区切り文字として使われることがある
- Excel日本語版は状況によってタブまたはカンマを使用

### データ内の区切り文字
- データ内にタブやカンマが含まれる場合はクォート処理
- PapaParseライブラリが自動的に処理

### 推奨事項
1. **クリップボード操作が主な場合**: デフォルト（タブ）のまま使用
2. **CSVファイル処理が主な場合**: 明示的に`,`を指定
3. **混在する場合**: 自動検出に任せる