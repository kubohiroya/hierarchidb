# ESLint + Prettier to Biome Migration Assessment

## Executive Summary

**結論: Biomeへの移行は可能ですが、いくつかの制限事項があります。**

Biomeは、ESLint + Prettierの主要な機能の約80-90%をカバーできますが、特定の高度な機能については完全な互換性がありません。

## 現在の設定の分析

### ESLint設定
- TypeScript対応（typescript-eslint）
- 相対パスインポートの禁止
- インポート順序の整理
- 未使用変数の警告（アンダースコア接頭辞は無視）
- Type-aware rules（tsconfig.eslint.json使用）

### Prettier設定
- Print width: 100
- Tab width: 2 (spaces)
- Single quotes
- Trailing comma: ES5
- Arrow parens: always
- Line ending: LF

## Biomeでサポートされる機能 ✅

### フォーマット機能（Prettierの代替）
- ✅ インデント幅（2スペース）
- ✅ 行の最大幅（100文字）
- ✅ シングルクォート使用
- ✅ トレーリングカンマ（ES5）
- ✅ アロー関数の括弧（always）
- ✅ ブラケットスペーシング
- ✅ 改行コード（LF）
- ✅ セミコロン（必須）

### リント機能（ESLintの代替）
- ✅ TypeScript完全対応
- ✅ 未使用変数の検出
- ✅ 未使用インポートの検出
- ✅ const優先の警告
- ✅ 基本的なコード品質チェック
- ✅ JSX/TSXサポート

## Biomeでサポートされない/制限がある機能 ⚠️

### ESLint関連
1. **相対パスインポートの禁止** ⚠️
   - Biomeには`noRestrictedImports`ルールがありません
   - 代替: カスタムルールの作成が必要

2. **インポート順序の自動整理** ⚠️
   - Biomeの`organizeImports`は基本的なアルファベット順のみ
   - ESLintのような詳細なグループ分けはできません

3. **アンダースコア接頭辞の無視パターン** ⚠️
   - `argsIgnorePattern`や`varsIgnorePattern`の設定不可
   - すべての未使用変数が警告対象になる

4. **Type-aware rules** ⚠️
   - Biomeはtsconfigを参照しない
   - 型に基づく高度なルールは利用不可

### Prettier関連
- すべての主要機能はサポートされています ✅

## 移行のメリット

1. **パフォーマンス**: Rustで書かれており、ESLint+Prettierより10-20倍高速
2. **シンプルな設定**: 1つの設定ファイルで完結
3. **統合ツール**: フォーマッターとリンターが統合
4. **メモリ効率**: 大規模プロジェクトでも低メモリ使用量
5. **並列処理**: ネイティブでマルチスレッド対応

## 移行のデメリット

1. **エコシステム**: ESLintプラグインが使えない
2. **カスタマイズ性**: ESLintほど柔軟な設定ができない
3. **成熟度**: ESLintと比較して新しいツール
4. **移行コスト**: 既存のCIパイプラインや開発フローの変更が必要

## 推奨事項

### 段階的移行アプローチ

1. **フェーズ1: 並行運用（推奨）**
   ```json
   {
     "scripts": {
       "lint": "eslint . --ext .ts,.tsx",
       "format": "prettier --write .",
       "check:biome": "biome check .",
       "format:biome": "biome format --write ."
     }
   }
   ```

2. **フェーズ2: Biomeをメインに移行**
   - CIでBiomeを使用
   - 開発者はBiomeとESLint/Prettierを選択可能

3. **フェーズ3: 完全移行**
   - ESLint/Prettierを削除
   - Biome専用に移行

### 移行できない機能への対処法

1. **相対パスインポートの禁止**
   - TypeScriptのpath mappingを活用
   - ビルド時のチェックツールを追加

2. **インポート順序**
   - Biomeの基本的な整理で妥協
   - または手動でのレビュー

3. **アンダースコア接頭辞の無視**
   - Biomeの将来のアップデートを待つ
   - または一時的に警告を受け入れる

## パッケージ.jsonの変更例

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "check": "biome check . && tsc --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "2.2.0"
    // ESLint/Prettier関連は段階的に削除
  }
}
```

## 結論

**移行は技術的に可能ですが、以下の条件を受け入れる必要があります：**

1. 相対パスインポート禁止ルールの喪失
2. インポート順序の詳細な制御の喪失
3. アンダースコア接頭辞の無視パターンの喪失

**推奨：**
- パフォーマンスが重要な場合 → Biomeへの移行を推奨
- 既存のルールを厳密に維持したい場合 → ESLint + Prettierの継続を推奨
- 妥協案：段階的移行で両方のツールを並行運用

## 次のステップ

1. チームでの議論と方針決定
2. 段階的移行の開始（並行運用から）
3. 開発者フィードバックの収集
4. 最終的な移行判断