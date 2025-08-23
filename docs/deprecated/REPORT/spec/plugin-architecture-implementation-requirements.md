# プラグインアーキテクチャ実装 要件定義書

## 概要

hierarchidbプロジェクトにおける統合プラグインアーキテクチャの実装要件を定義する。本アーキテクチャは、AOP（Aspect-Oriented Programming）アプローチを採用し、NodeTypeRegistryを中心とした統合管理システムを構築する。

## 関連文書

- **ユーザストーリー**: [📖 plugin-architecture-implementation-user-stories.md](plugin-architecture-implementation-user-stories.md)
- **受け入れ基準**: [✅ plugin-architecture-implementation-acceptance-criteria.md](plugin-architecture-implementation-acceptance-criteria.md)
- **設計文書**: 
  - [6-plugin-modules.md](../6-plugin-modules.md)
  - [7-aop-architecture.md](../7-aop-architecture.md)
  - [8-plugin-routing-system.md](../8-plugin-routing-system.md)

## 機能要件（EARS記法）

### 通常要件

- REQ-001: システムは NodeTypeRegistry をシングルトンパターンで実装し、統合プラグインレジストリとして機能しなければならない 🟢
- REQ-002: システムは UnifiedPluginDefinition インターフェースを使用してプラグインを定義しなければならない 🟢
- REQ-003: システムは プラグインのライフサイクルフック（beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete）を適切なタイミングで実行しなければならない 🟢
- REQ-004: システムは EntityHandler を通じてエンティティとサブエンティティの CRUD 操作を提供しなければならない 🟢
- REQ-005: システムは WorkerAPIExtensions を通じてノードタイプ固有の API メソッドを登録・実行できなければならない 🟢
- REQ-006: システムは UIComponentRegistry を通じて動的に UI コンポーネントを登録・取得できなければならない 🟢
- REQ-007: システムは React Router v7 と統合してファイルシステムベースのルーティングを提供しなければならない 🟢

### 条件付き要件

- REQ-101: プラグインが dependencies を定義している場合、システムは依存プラグインが既に登録されていることを確認しなければならない 🟢
- REQ-102: 同一の nodeType でプラグインが重複登録された場合、システムはエラーを発生させなければならない 🟢
- REQ-103: プラグインが priority 値を持つ場合、システムは昇順でプラグインを初期化しなければならない 🟢
- REQ-104: ライフサイクルフックで警告が発生した場合はconsole.warnで出力し処理を継続、エラーが発生した場合は操作全体をロールバックしなければならない 🟢
- REQ-105: プラグインが validation ルールを定義している場合、システムはエンティティ操作時に検証を実行しなければならない 🟢

### 状態要件

- REQ-201: Resourcesツリー内にある場合、システムは basemap, stylemaps, shapes, locations, routes, propertyresolver プラグインを利用可能にしなければならない 🟢
- REQ-202: Projectsツリー内にある場合、システムは project プラグインを利用可能にし、Resourcesツリーノードへの参照を許可しなければならない 🟢
- REQ-203: ワーキングコピーが存在する場合、システムは commitWorkingCopy または discardWorkingCopy 操作を提供しなければならない 🟢

### オプション要件

- REQ-301: システムは 開発サーバー運用時にnpm依存モジュールとしてホットリロードに対応する 🟢
- REQ-302: システムは プラグインのバージョン管理機能を提供してもよい 🟡

### 制約要件

- REQ-401: システムは TypeScript の型安全性を完全に保証しなければならない 🟢
- REQ-402: システムは プラグイン検索を O(1) の計算量で実行しなければならない 🟢
- REQ-403: システムは 循環依存を防止するため、異なるツリー間でのみノード参照を許可しなければならない 🟢
- REQ-404: システムは ビルド時エラーを標準エラー出力に、実行時エラーを console.error に出力しなければならない 🟢

## 非機能要件

### パフォーマンス

- NFR-001: プラグインはビルド時に静的に組み込まれ、実行時の動的検索は不要とする 🟢

### セキュリティ

- NFR-101: プラグインは定義されたインターフェース以外のシステムリソースにアクセスできてはならない 🟡
- NFR-102: プラグイン間のデータアクセスは明示的な API 経由でのみ許可されなければならない 🟢

### ユーザビリティ

- NFR-201: プラグイン開発者は TypeScript の型補完を活用して開発できなければならない 🟢
- NFR-202: エラーメッセージは最小限の内容で十分とする 🟢

### 保守性

- NFR-301: プラグインは独立したパッケージとして開発・配布可能でなければならない 🟢
- NFR-302: プラグインのテストは独立して実行可能でなければならない 🟡

## Edgeケース

### エラー処理

- EDGE-001: 必須フィールドが欠けた NodeTypeDefinition が登録された場合、詳細なエラーメッセージを出力する 🟢
- EDGE-002: 存在しない nodeType でプラグインを取得しようとした場合、undefined を返す 🟢
- EDGE-003: ライフサイクルフック内で例外が発生した場合、他のフックの実行を継続する 🟡

### 境界値

- EDGE-101: null または undefined の nodeType が指定された場合、例外を投げる 🟢
- EDGE-102: 空の UnifiedPluginDefinition が登録された場合、最小限の必須フィールドで動作する 🟡

### 競合状態

- EDGE-201: リソースアクセスの競合は基本的に考慮不要、必要な場合はトランザクションまたは楽観的ロックを使用 🟢

## プラグイン種別と配置

### Resourcesツリー専用プラグイン

- basemap: MapLibreGLJS での基本地図表示 🟢
- stylemaps: CSV データからのスタイル情報提供 🟢
- shapes: GeoJSON の簡略化とベクトルタイル生成 🟢
- locations: 地点情報（都市、港湾、空港等）の管理 🟢
- routes: 経路情報（海路、空路、道路等）の管理 🟢
- propertyresolver: GeoJSON properties の変換ルール定義 🟢

### Projectsツリー専用プラグイン

- project: Resourcesツリーノードの参照・集約表示 🟢

### 共通プラグイン

- folder: 両ツリーで使用可能な汎用フォルダ機能 🟢

## 実装優先度

1. **Phase 1（必須）**: REQ-001～007, REQ-401～404
2. **Phase 2（重要）**: REQ-101～105, REQ-201～203
3. **Phase 3（推奨）**: NFR-001～302, EDGE-001～003
4. **Phase 4（将来）**: REQ-301～302, EDGE-101～201

## 変更履歴

- 2025-01-28: 初版作成（統合プラグインアーキテクチャ仕様に基づく）