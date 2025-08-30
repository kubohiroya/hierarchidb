#!/usr/bin/env node

/**
 * PDF Generation with Translation Script
 * Generates PDFs with automatic translation support
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePDF, collectMarkdownFiles, combineMarkdownFiles } from './generate-pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

/**
 * Translation mappings for common technical terms
 */
const translations = {
  // Headers
  'Overview': '概要',
  'Prerequisites': '前提条件',
  'When to Read This Document': 'このドキュメントを読むタイミング',
  'Getting Started': 'はじめに',
  'Installation': 'インストール',
  'Configuration': '設定',
  'Usage': '使用方法',
  'API Reference': 'APIリファレンス',
  'Examples': '例',
  'Troubleshooting': 'トラブルシューティング',
  'Best Practices': 'ベストプラクティス',
  'Performance': 'パフォーマンス',
  'Security': 'セキュリティ',
  'Testing': 'テスト',
  'Deployment': 'デプロイメント',
  'Migration': 'マイグレーション',
  'Architecture': 'アーキテクチャ',
  'Database': 'データベース',
  'Plugin System': 'プラグインシステム',
  
  // Technical terms
  'tree structure': 'ツリー構造',
  'node': 'ノード',
  'entity': 'エンティティ',
  'working copy': 'ワーキングコピー',
  'subscription': 'サブスクリプション',
  'handler': 'ハンドラー',
  'lifecycle': 'ライフサイクル',
  'hook': 'フック',
  'component': 'コンポーネント',
  'service': 'サービス',
  'worker': 'ワーカー',
  'thread': 'スレッド',
  'cache': 'キャッシュ',
  'transaction': 'トランザクション',
  'rollback': 'ロールバック',
  'commit': 'コミット',
  'query': 'クエリ',
  'mutation': 'ミューテーション',
  'observable': 'オブザーバブル',
  'branded type': 'ブランド型',
  
  // UI terms
  'button': 'ボタン',
  'dialog': 'ダイアログ',
  'panel': 'パネル',
  'toolbar': 'ツールバー',
  'breadcrumb': 'パンくずリスト',
  'tree view': 'ツリービュー',
  'context menu': 'コンテキストメニュー',
  'drag and drop': 'ドラッグアンドドロップ',
  
  // Actions
  'Create': '作成',
  'Read': '読み取り',
  'Update': '更新',
  'Delete': '削除',
  'Save': '保存',
  'Cancel': 'キャンセル',
  'Submit': '送信',
  'Import': 'インポート',
  'Export': 'エクスポート',
  'Download': 'ダウンロード',
  'Upload': 'アップロード',
  'Search': '検索',
  'Filter': 'フィルター',
  'Sort': 'ソート',
  'Expand': '展開',
  'Collapse': '折りたたみ',
  
  // Status
  'Loading': '読み込み中',
  'Error': 'エラー',
  'Success': '成功',
  'Warning': '警告',
  'Info': '情報',
  'Pending': '保留中',
  'Complete': '完了',
  'Failed': '失敗',
  
  // Common phrases
  'Click here': 'ここをクリック',
  'Learn more': '詳細を見る',
  'See also': '関連項目',
  'Note': '注意',
  'Important': '重要',
  'Tip': 'ヒント',
  'Example': '例',
  'Required': '必須',
  'Optional': 'オプション',
  'Default': 'デフォルト',
  'Recommended': '推奨'
};

/**
 * Simple translation function for headers and key terms
 */
function translateContent(content, toJapanese = true) {
  if (!toJapanese) return content;
  
  let translated = content;
  
  // Translate common terms
  for (const [en, ja] of Object.entries(translations)) {
    // Case-insensitive replacement for headers
    const regex = new RegExp(`^(#+\\s*)${en}(\\s*)$`, 'gmi');
    translated = translated.replace(regex, `$1${ja}$2`);
    
    // Replace in text (word boundaries)
    const textRegex = new RegExp(`\\b${en}\\b`, 'g');
    translated = translated.replace(textRegex, ja);
  }
  
  return translated;
}

/**
 * Generate documentation summaries
 */
function generateSummary(isJapanese = false) {
  if (isJapanese) {
    return `
# HierarchiDB ドキュメント概要

## このドキュメントについて

HierarchiDBは、ブラウザ環境向けの高性能ツリー構造データ管理フレームワークです。
このドキュメントは、システムの包括的なガイドを提供します。

## ドキュメント構成

### ユーザーマニュアル
- システムの基本的な使用方法
- UIコンポーネントの操作方法
- プラグインの使用方法

### 技術マニュアル
- アーキテクチャの詳細
- API仕様
- 実装ガイド

### 開発者レポート
- パフォーマンス分析
- コード品質レポート
- 移行ガイド

## クイックリンク

- [はじめに](#getting-started)
- [アーキテクチャ](#architecture)
- [APIリファレンス](#api-reference)
- [プラグインシステム](#plugin-system)

---
`;
  } else {
    return `
# HierarchiDB Documentation Summary

## About This Documentation

HierarchiDB is a high-performance tree-structured data management framework for browser environments.
This documentation provides comprehensive guidance for the system.

## Documentation Structure

### User Manual
- Basic system usage
- UI component operations
- Plugin usage

### Technical Manual
- Architecture details
- API specifications
- Implementation guides

### Developer Report
- Performance analysis
- Code quality reports
- Migration guides

## Quick Links

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Plugin System](#plugin-system)

---
`;
  }
}

/**
 * Generate combined PDF with all documentation
 */
async function generateCombinedPDF(isJapanese = false) {
  const pdfDir = path.join(rootDir, 'docs', 'pdf');
  await fs.mkdir(pdfDir, { recursive: true });
  
  const title = isJapanese ? 
    'HierarchiDB 完全ドキュメント' : 
    'HierarchiDB Complete Documentation';
  
  const outputPath = path.join(pdfDir, 
    isJapanese ? 'HierarchiDB-Complete-JA.pdf' : 'HierarchiDB-Complete-EN.pdf'
  );
  
  console.log(`\n📚 Generating combined ${isJapanese ? 'Japanese' : 'English'} documentation...`);
  
  // Collect all documentation
  const docDirs = [
    { path: path.join(rootDir, 'docs', 'MANUAL-USER'), section: isJapanese ? 'ユーザーマニュアル' : 'User Manual' },
    { path: path.join(rootDir, 'docs', 'MANUAL'), section: isJapanese ? '技術マニュアル' : 'Technical Manual' },
    { path: path.join(rootDir, 'docs', 'REPORT'), section: isJapanese ? '開発者レポート' : 'Developer Report' }
  ];
  
  let combinedContent = generateSummary(isJapanese);
  
  for (const doc of docDirs) {
    console.log(`  Processing ${doc.section}...`);
    
    // Add section header
    combinedContent += `\n\n<div class="page-break"></div>\n\n`;
    combinedContent += `# ${doc.section}\n\n`;
    
    // Collect and combine files
    const files = await collectMarkdownFiles(doc.path);
    const content = await combineMarkdownFiles(files, doc.path);
    
    // Translate if needed
    const translated = translateContent(content, isJapanese);
    combinedContent += translated;
  }
  
  // Generate PDF
  await generatePDF(combinedContent, outputPath, title, isJapanese);
  
  return outputPath;
}

/**
 * Generate quick reference card
 */
async function generateQuickReference(isJapanese = false) {
  const pdfDir = path.join(rootDir, 'docs', 'pdf');
  
  const content = isJapanese ? `
# HierarchiDB クイックリファレンス

## 基本コマンド

### 開発
\`\`\`bash
pnpm install  # 依存関係のインストール
pnpm dev      # 開発サーバー起動
pnpm build    # ビルド
pnpm test     # テスト実行
\`\`\`

## アーキテクチャ

### 4層構造
1. **UIレイヤー** - React/MUI
2. **APIレイヤー** - Comlink RPC
3. **ワーカーレイヤー** - ビジネスロジック
4. **データベースレイヤー** - IndexedDB/Dexie

## 主要な型

### ブランド型
\`\`\`typescript
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type EntityId = string & { readonly __brand: 'EntityId' };
\`\`\`

## プラグインシステム

### プラグイン定義
\`\`\`typescript
const MyNodeDefinition: NodeTypeDefinition = {
  nodeType: 'mytype',
  database: { /* ... */ },
  entityHandler: new MyEntityHandler(),
  lifecycle: { /* ... */ },
  ui: { /* ... */ }
};
\`\`\`

## API使用例

### ノード作成
\`\`\`typescript
const api = await getWorkerAPI();
const node = await api.createNode({
  parentNodeId: parentId,
  name: 'New Node',
  nodeType: 'folder'
});
\`\`\`

### サブスクリプション
\`\`\`typescript
const unsubscribe = await api.subscribeToNode(
  nodeId,
  (update) => console.log('Node updated:', update)
);
\`\`\`
` : `
# HierarchiDB Quick Reference

## Basic Commands

### Development
\`\`\`bash
pnpm install  # Install dependencies
pnpm dev      # Start dev server
pnpm build    # Build project
pnpm test     # Run tests
\`\`\`

## Architecture

### 4-Layer Structure
1. **UI Layer** - React/MUI
2. **API Layer** - Comlink RPC
3. **Worker Layer** - Business logic
4. **Database Layer** - IndexedDB/Dexie

## Key Types

### Branded Types
\`\`\`typescript
type NodeId = string & { readonly __brand: 'NodeId' };
type TreeId = string & { readonly __brand: 'TreeId' };
type EntityId = string & { readonly __brand: 'EntityId' };
\`\`\`

## Plugin System

### Plugin Definition
\`\`\`typescript
const MyNodeDefinition: NodeTypeDefinition = {
  nodeType: 'mytype',
  database: { /* ... */ },
  entityHandler: new MyEntityHandler(),
  lifecycle: { /* ... */ },
  ui: { /* ... */ }
};
\`\`\`

## API Examples

### Create Node
\`\`\`typescript
const api = await getWorkerAPI();
const node = await api.createNode({
  parentNodeId: parentId,
  name: 'New Node',
  nodeType: 'folder'
});
\`\`\`

### Subscription
\`\`\`typescript
const unsubscribe = await api.subscribeToNode(
  nodeId,
  (update) => console.log('Node updated:', update)
);
\`\`\`
`;

  const title = isJapanese ? 'HierarchiDB クイックリファレンス' : 'HierarchiDB Quick Reference';
  const outputPath = path.join(pdfDir, 
    isJapanese ? 'HierarchiDB-QuickRef-JA.pdf' : 'HierarchiDB-QuickRef-EN.pdf'
  );
  
  await generatePDF(content, outputPath, title, isJapanese);
  return outputPath;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting PDF generation with translations...\n');
  
  try {
    // Generate individual PDFs
    const pdfs = [];
    
    // Japanese versions
    pdfs.push(await generateCombinedPDF(true));
    pdfs.push(await generateQuickReference(true));
    
    // English versions
    pdfs.push(await generateCombinedPDF(false));
    pdfs.push(await generateQuickReference(false));
    
    console.log('\n✨ PDF generation complete!');
    console.log('📁 Generated files:');
    pdfs.forEach(pdf => console.log(`   - ${path.basename(pdf)}`));
    
  } catch (error) {
    console.error('❌ Error during PDF generation:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { translateContent, generateCombinedPDF, generateQuickReference };