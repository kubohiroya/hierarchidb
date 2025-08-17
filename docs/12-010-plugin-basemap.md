# 12-1. プラグイン: basemap（基本地図）

本章では、6章/7章/8章/11章で示した統合プラグイン設計（UnifiedPluginDefinition と NodeTypeRegistry、ルーティング統合）に基づき、basemap プラグインの仕様と画面・API 契約、設計・実装方針をまとめる。なお、本リポジトリには packages/plugins/basemap として実装が存在するため（Unified 定義・DB・UI 含む）、ここでは実装の要点を要約しつつ、統合上の確認事項や不整合点を TODO として明示する。

- 参照ドキュメント
  - 6章: docs/6-plugin-modules.md
  - 7章: docs/7-aop-architecture.md
  - 8章: docs/8-plugin-routing-system.md
  - 11章: docs/11-plugin-ui.md

## 12.1.1 概要
- 目的: MapLibre GL JS で表示する「基本地図（Base Map）」リソースを管理・表示する。
- Tree: Resources ツリー配下のノードタイプ。
- NodeType: `basemap`
- 代表的なユースケース:
  - 基本地図スタイル（style URL または JSON）、初期表示位置（中心座標・ズーム）等を保存
  - プロジェクト（project プラグイン）に参照され、統合表示のベースレイヤーになる

## 12.1.2 データモデル（Entity / Working Copy）
- Entity: BaseMapEntity（例）
  - id: string
  - name: string
  - style: string | URL | JSON
  - center: [lng: number, lat: number]
  - zoom: number
  - bearing?: number
  - pitch?: number
  - createdAt: number
  - updatedAt: number
- WorkingCopy: BaseMapWorkingCopy（例）
  - 編集中の一時状態。5章の working copy モデルに準拠。

注意: 具体の型定義は 6章の例示をベースにするが、実装時に core 型群と整合させること。

## 12.1.3 UnifiedPluginDefinition（想定）
6章/11章の例に準拠。

```ts
export const BaseMapUnifiedDefinition: UnifiedPluginDefinition<BaseMapEntity, never, BaseMapWorkingCopy> = {
  nodeType: 'basemap',
  name: 'BaseMap',
  displayName: 'Base Map',
  database: { entityStore: 'basemaps', schema: {}, version: 1 },
  entityHandler: new BaseMapHandler(),
  lifecycle: { afterCreate, beforeDelete },
  routing: {
    actions: {
      view: { component: lazy(() => import('../ui/MapView')), displayName: 'Map View' },
      edit: { component: lazy(() => import('../ui/MapEditor')), displayName: 'Map Editor' }
    },
    defaultAction: 'view'
  },
  meta: {
    version: '1.0.0',
    description: 'MapLibreGLJSで表示する基本的な地図を提供',
    tags: ['map', 'resources', 'visualization']
  }
};
```

## 12.1.4 ルーティングと UI
- 外部仕様 URL（8章）: `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?`
- basemap の例:
  - 一覧（フォルダ内）はフォルダ機能に依存
  - 表示: `/t/:treeId/.../basemap/view`
  - 編集: `/t/:treeId/.../basemap/edit`
- レンダリング: 11章の説明どおり、`treeNodeType='basemap'` と `action` に応じて Registry 経由で UI コンポーネントを取得・レンダリング。
- 想定 UI コンポーネント
  - MapView: 読み取り専用の表示
  - MapEditor: スタイル URL/JSON、中心、ズーム等を編集

## 12.1.5 LoaderData と必要データ
- 11章の LoaderData 契約を使用。
  - treeContext（ツリー情報）
  - targetNode（操作対象のノード）
  - pluginData（プラグイン独自）
- basemap の pluginData 例
  - entity: BaseMapEntity
  - resolvedStyle: レンダリングに用いる実スタイル URL / JSON

## 12.1.6 Worker/API 拡張
- 6章での方針:
  - WorkerAPIExtensions にて basemap エンティティの CRUD、スタイル検証、参照整合性チェックを提供可能。
- 例（概念）
  - getBaseMap(id) / saveBaseMap(entity) / deleteBaseMap(id)
  - validateStyle(style): スタイル URL/JSON の検証

## 12.1.7 ライフサイクルフック
- afterCreate: 新規ノード作成時にデフォルトのスタイルや初期表示をセット
- beforeDelete: 参照整合性（project等から参照中の場合の警告/ブロック）

## 12.1.8 権限
- 9章の認証/権限と統合。編集系は適切なロール/スコープが必要。

## 12.1.9 受け入れ基準（サマリ）
- NodeTypeRegistry に `basemap` 定義が登録できる
- `/t/.../basemap/view` と `/t/.../basemap/edit` で UI が動的ロード
- Entity の保存・読み込み（IndexedDB/Dexie 想定）が可能
- プロジェクトからの参照に耐える（将来拡張）

## 12.1.10 TODO（仕様の不備・設計の矛盾・未実装）
- 実装確認済み: `packages/plugins/basemap` に Unified 定義・DB・UI が存在
  - 対応: 実装要点のドキュメント反映と、アプリ側ルーティング（11章）との動作確認を継続
- NodeTypeRegistry/UnifiedPluginDefinition のアプリ統合検証未了（7章は文書、実配線は要確認）
  - 対応: core/worker/ui の各層からレジストリ参照を実機確認し、動的レンダリングを E2E で検証
- MapView/MapEditor の具象 UI の要件化（現状コンポーネントはあるが UX 要件は未定義）
  - 対応: 11章のルータ連携に基づく最小 UX 要件を定義
- スタイルの型（URL/JSON）と検証 API のエラーモデル未確定
  - 対応: `validateStyle` の仕様（同期/非同期、エラーコード）を策定
- 参照整合性（project からの参照保護）
  - 対応: beforeDelete での参照カウントチェック仕様を策定
