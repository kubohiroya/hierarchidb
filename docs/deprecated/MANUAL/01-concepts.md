# 基本概念と用語定義

# 基本概念と用語定義

## この章について

この章では、HierarchiDBシステムを理解し、効果的に使用するために必要な基本概念と用語について説明します。

**読むべき人**: HierarchiDBの基本操作を学習する方、システム構造を理解したい開発者
**前提知識**: [01-overview.md](./01-overview.md)の内容を理解していること
**読むタイミング**: 
- 初回セットアップ後、実際の操作に入る前
- ツリー構造やプラグインの概念に疑問が生じた時
- 他のユーザーに操作を説明する前の予習として

この章では、TreeNode、Entity、Working Copy、Plugin等のコア概念を学習します。これらの概念は、後続の操作説明やトラブルシューティングで頻繁に使用されるため、しっかりと理解しておくことが重要です。特に、プラグイン（BaseMap、StyleMap、Shape、Spreadsheet、Project）の役割分担を理解することで、適切なデータ管理が可能になります。

## コア概念

### TreeNode（ツリーノード）
階層構造の基本単位。すべてのデータはTreeNodeとして表現されます。

**主要プロパティ:**
- `id`: 一意識別子（UUID）
- `parentId`: 親ノードのID
- `treeNodeType`: ノードの種類（folder, basemap, stylemap, shapes等）
- `name`: 表示名
- `description`: 説明文
- `isDraft`: ドラフト状態フラグ

### Tree（ツリー）
TreeNodeの集合体として管理される階層構造全体。

### Entity（エンティティ）
TreeNodeに紐づけられた追加情報。プラグインごとに定義されます。

## エンティティ分類システム

### 2×3 エンティティ分類

エンティティは2つの軸で分類されます：

#### 紐付けの構造（3種類）
1. **Peer（1対1）**: TreeNodeと1対1で対応
2. **Group（1対N）**: 1つのTreeNodeに複数のエンティティ
3. **Relation（N対N）**: 複数のTreeNodeで共有

#### ライフサイクル（2種類）
1. **Persistent（永続的）**: CoreDBに保存、長期保存
2. **Ephemeral（一時的）**: EphemeralDBに保存、セッション限定

### 組み合わせマトリックス

| | Peer | Group | Relation |
|---|---|---|---|
| **Persistent** | 設定データ<br>(StyleMap, BaseMap) | 成果物データ<br>(VectorTiles) | 共有リソース<br>(TableMetadata) |
| **Ephemeral** | UI状態<br>(ViewState) | 中間処理データ<br>(ProcessBuffer) | セッション管理<br>(BatchSession) |

## ワーキングコピーシステム

### WorkingCopy（ワーキングコピー）
編集時に作成される一時的なデータのコピー。

**特徴:**
- EphemeralDBに保存
- オリジナルと同じIDを使用
- コピーオンライト方式
- 編集完了時にオリジナルに反映

### Draft（ドラフト）
未完成の編集状態を保存する機能。

**特徴:**
- `isDraft`プロパティで管理
- 通常利用に制限あり
- 後で編集を再開可能

## データベース構造

### CoreDB（コアデータベース）
永続的なデータを保存するメインデータベース。

**保存対象:**
- TreeEntity（ツリーメタデータ）
- TreeNodeEntity（ノード階層）
- Persistentエンティティ

### EphemeralDB（一時データベース）
セッション限定のデータを保存する一時データベース。

**保存対象:**
- WorkingCopyEntity（編集中データ）
- TreeViewStateEntity（UI状態）
- Ephemeralエンティティ

## プラグインシステム

### Plugin（プラグイン）
特定の機能を提供する拡張モジュール。

**構成要素:**
- NodeTypeDefinition（ノードタイプ定義）
- EntityHandler（エンティティ処理）
- UI Components（UIコンポーネント）
- Lifecycle Hooks（ライフサイクルフック）

### NodeType（ノードタイプ）
プラグインが定義するTreeNodeの種類。

**標準ノードタイプ:**
- `folder`: フォルダ
- `basemap`: 地図設定
- `stylemap`: スタイルマップ
- `shapes`: 地理空間データ
- `spreadsheet`: 表形式データ（CSV、TSV、Excel等）
- `project`: プロジェクト管理

## 操作概念

### CRUD操作
- **Create**: 新規作成
- **Read**: 読み取り
- **Update**: 更新
- **Delete**: 削除

### 高度な操作
- **Undo/Redo**: 操作の取り消し/やり直し
- **Copy/Paste**: コピー/貼り付け
- **Move**: 移動
- **Trash**: ゴミ箱への移動と復元

## UI概念

### Dialog（ダイアログ）
オブジェクトの作成・編集用のモーダルウィンドウ。

**種類:**
- プラグインダイアログ（各ノードタイプ用）
- Discard確認ダイアログ
- システムダイアログ

### Multi-step Wizard（マルチステップウィザード）
複雑な設定を段階的に行うUI。

**例:**
- StyleMapの6ステップ設定
- Shapesの4段階バッチ処理

## 次のステップ

- [アーキテクチャ詳細](./02-architecture-overview.md)
- [プラグインシステム](./04-plugin-overview.md)
- [開発ガイド](./05-dev-guidelines.md)