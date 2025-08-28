# HierarchiDB ドキュメント構成

## ドキュメント体系

このドキュメントは以下の構成で整理されています：

### 第1部: 概要とコンセプト (01-*)
- **01-overview.md** - システム概要と主要機能
- **01-concepts.md** - 基本概念と用語定義
- **01-requirements.md** - システム要件と制約

### 第2部: アーキテクチャ (02-*)
- **02-architecture-overview.md** - 全体アーキテクチャ
- **02-architecture-data-model.md** - データモデルとエンティティシステム

### 第3部: コア機能 (03-*)
- **03-core-operations.md** - 基本操作（CRUD、Undo/Redo、Copy/Paste、Trash）
- **03-core-dialog.md** - ダイアログシステム
- **03-api-reference.md** - APIリファレンス（WorkerAPI、Query、Mutation、Observable、WorkingCopyTypes、PluginRegistry）

### 第4部: プラグインシステム (04-*)
- **04-plugin-entity-system.md** - 2×3エンティティ分類システム
- **04-plugin-lifecycle.md** - エンティティライフサイクル管理
- **04-plugin-catalog.md** - 標準プラグインカタログ

### 第5部: 開発ガイド (05-*)
- **05-dev-environment.md** - 開発環境構築
- **05-dev-guidelines.md** - コーディング規約

### 特別文書
- **10-3-plugin-shape.md** - Shapeプラグイン詳細仕様
- **X-dialog.md** - ダイアログシステム詳細設計

### 技術仕様書
- **technical-architecture-specification.md** - 技術アーキテクチャ仕様（UML図付き）
- **build-system-strategy.md** - ビルドシステム戦略
- **test-strategy.md** - テスト戦略
- **package-export-guidelines.md** - パッケージエクスポートガイドライン

### 実装・移行関連
- **implementation-analysis-report.md** - 実装分析レポート
- **implementation-completion-report.md** - 実装完了レポート
- **implementation-migration-spec.md** - 実装移行仕様
- **import-export-migration-plan.md** - インポート/エクスポート移行計画
- **dialog-implementation-analysis.md** - ダイアログ実装分析
- **ui-dialog-migration-summary.md** - UIダイアログ移行サマリー
- **biome-migration-assessment.md** - Biome移行評価

### 改善・リファクタリング
- **refactoring-requirements.md** - リファクタリング要件
- **improvement-action-plan.md** - 改善アクションプラン
- **rev-shape.md** - Shapeプラグイン改訂版

### ライセンス情報
- **licenses.csv** - ライセンス一覧（CSV形式）
- **licenses.json** - ライセンス詳細（JSON形式）
- **licenses-summary.txt** - ライセンスサマリー
- **external-licenses.json** - 外部ライセンス
- **external-licenses-summary.txt** - 外部ライセンスサマリー

### サブディレクトリ（内部文書）
- **architecture/** - アーキテクチャ設計文書
- **deprecated/** - 廃止されたドキュメント
- **design/** - 設計ドキュメント
  - plugin-shapes/ - Shapeプラグイン設計
  - plugin-stylemap/ - StyleMapプラグイン設計
  - treeconsole-migration/ - TreeConsole移行設計
- **development/** - 開発関連文書
- **implementation/** - 実装詳細
- **implements/** - 実装メモ
  - plugin-shapes/ - Shapeプラグイン実装
  - hierarchical-plugin-routing/ - ルーティング実装
  - その他TDD実装記録
- **migration/** - 移行計画文書
- **reverse/** - リバースエンジニアリング文書
- **spec/** - 仕様書
- **tasks/** - タスク管理

## 読み方ガイド

### 初めての方
1. **01-overview.md** でシステムの全体像を理解
2. **01-concepts.md** で基本用語を確認
3. **02-architecture-overview.md** でアーキテクチャを把握
4. **03-api-reference.md** でAPIの基本を学習

### プラグイン開発者
1. **04-plugin-entity-system.md** でエンティティ分類を学習
2. **04-plugin-lifecycle.md** でライフサイクルを理解
3. **04-plugin-catalog.md** で既存プラグインを参考に
4. **technical-architecture-specification.md** でクラス構造を確認

### 実装者・コントリビューター
1. **05-dev-environment.md** で開発環境を構築
2. **05-dev-guidelines.md** でコーディング規約を確認
3. **test-strategy.md** でテスト方針を理解
4. **build-system-strategy.md** でビルドシステムを把握

### システム管理者
1. **package-export-guidelines.md** でパッケージ管理を理解
2. **import-export-migration-plan.md** でデータ移行方法を確認
3. **implementation-completion-report.md** で実装状況を把握

## ドキュメントの状態

### ✅ 完成度の高いドキュメント
- **technical-architecture-specification.md** - 包括的なUML図付き
- **02-architecture-overview.md** - 詳細な説明と図解
- **03-api-reference.md** - 開発者向けの実践的なガイド
- **04-plugin-entity-system.md** - エンティティ分類の詳細説明
- **03-core-operations.md** - CRUD操作の完全な解説

### 📝 参照可能なドキュメント
- **01-overview.md**, **01-concepts.md**, **01-requirements.md** - 基本情報
- **04-plugin-lifecycle.md**, **04-plugin-catalog.md** - プラグイン関連
- **05-dev-environment.md**, **05-dev-guidelines.md** - 開発ガイド

### 🔧 特定用途向けドキュメント
- **10-3-plugin-shape.md** - Shapeプラグインの実装者向け
- **X-dialog.md** - ダイアログシステムの内部仕様
- 各種移行・実装レポート - プロジェクト管理用

## 更新履歴

- 2024-08-22: ドキュメントインデックス更新
  - 実際に存在するファイルのみをリスト化
  - ドキュメントの完成度を明記
  - 読者別のガイドを現状に合わせて修正
- 2024-01-XX: ドキュメント全面再構築
  - 重複内容の統合
  - 番号体系の整理
  - X-dialog.md の内容を正式仕様として統合