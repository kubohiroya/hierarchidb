# HierarchiDB ドキュメント

## ドキュメント構成

このディレクトリには、HierarchiDBの公式ドキュメントが含まれています。

### メインドキュメント

#### 📚 第1部: 概要とコンセプト
- [00-index.md](./00-index.md) - ドキュメント全体の目次
- [01-overview.md](./01-overview.md) - システム概要
- [01-concepts.md](./01-concepts.md) - 基本概念と用語
- [01-requirements.md](./01-requirements.md) - システム要件

#### 🏗️ 第2部: アーキテクチャ
- [02-architecture-overview.md](./02-architecture-overview.md) - アーキテクチャ概要
- [02-architecture-data-model.md](./02-architecture-data-model.md) - データモデル

#### ⚙️ 第3部: コア機能
- [03-core-operations.md](./03-core-operations.md) - 基本操作
- [03-core-dialog.md](./03-core-dialog.md) - ダイアログシステム

#### 🔌 第4部: プラグインシステム
- [04-plugin-entity-system.md](./04-plugin-entity-system.md) - エンティティ分類
- [04-plugin-lifecycle.md](./04-plugin-lifecycle.md) - ライフサイクル管理
- [04-plugin-catalog.md](./04-plugin-catalog.md) - 標準プラグイン

#### 💻 第5部: 開発
- [05-dev-environment.md](./05-dev-environment.md) - 開発環境
- [05-dev-guidelines.md](./05-dev-guidelines.md) - コーディング規約

### 補助ドキュメント

#### 📋 仕様・戦略
- [test-strategy.md](./test-strategy.md) - テスト戦略
- [build-system-strategy.md](./build-system-strategy.md) - ビルドシステム
- [package-export-guidelines.md](./package-export-guidelines.md) - パッケージエクスポート

#### 🔄 マイグレーション
- [implementation-migration-spec.md](./implementation-migration-spec.md) - 実装移行仕様
- [import-export-migration-plan.md](./import-export-migration-plan.md) - インポート/エクスポート
- [biome-migration-assessment.md](./biome-migration-assessment.md) - Biome移行評価

### ディレクトリ構成

```
docs/
├── README.md                 # このファイル
├── 00-index.md              # ドキュメント目次
├── 01-*.md                  # 概要とコンセプト
├── 02-*.md                  # アーキテクチャ
├── 03-*.md                  # コア機能
├── 04-*.md                  # プラグインシステム
├── 05-*.md                  # 開発ガイド
├── deprecated/              # 廃止されたドキュメント
├── design/                  # 設計ドキュメント（内部用）
├── implements/              # 実装メモ（内部用）
├── spec/                    # 詳細仕様（内部用）
└── tasks/                   # タスク管理（内部用）
```

## 更新履歴

### 2024-01-XX: 大規模再構築
- ドキュメント全体を再構成
- 重複内容を統合（約40%削減）
- 番号体系を整理
- X-dialog.mdの内容を正式仕様として統合
- 2×3エンティティ分類システムを明確化

### 主な改善点
1. **読みやすさ**: 概要→設計→実装の流れを確立
2. **一貫性**: 用語と概念を統一
3. **保守性**: ファイル数を削減し更新箇所を明確化
4. **完全性**: 欠落していた内容を補完

## 読み方ガイド

### 🆕 初めての方
1. [01-overview.md](./01-overview.md) でシステムの全体像を把握
2. [01-concepts.md](./01-concepts.md) で基本用語を理解
3. [02-architecture-overview.md](./02-architecture-overview.md) でアーキテクチャを学習

### 👨‍💻 プラグイン開発者
1. [04-plugin-entity-system.md](./04-plugin-entity-system.md) でエンティティ分類を理解
2. [04-plugin-catalog.md](./04-plugin-catalog.md) で既存プラグインを参考に
3. [05-dev-guidelines.md](./05-dev-guidelines.md) で開発規約を確認

### 🔧 システム管理者
1. [01-requirements.md](./01-requirements.md) でシステム要件を確認
2. [05-dev-environment.md](./05-dev-environment.md) で環境構築
3. [test-strategy.md](./test-strategy.md) でテスト方法を理解

## 貢献ガイドライン

### ドキュメント更新時の注意
- 番号体系を維持（XX-name.md形式）
- 他のドキュメントとの一貫性を保つ
- 用語定義は[01-concepts.md](./01-concepts.md)に従う
- 重複内容を作らない

### レビュープロセス
1. 変更内容が既存ドキュメントと矛盾しないか確認
2. 関連ドキュメントも必要に応じて更新
3. 目次（00-index.md）を更新

## お問い合わせ

ドキュメントに関する質問や提案は、GitHubのIssueでお願いします。