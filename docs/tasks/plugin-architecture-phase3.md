# プラグインアーキテクチャ Phase 3: プラグイン開発

## フェーズ概要

- **期間**: 3週間（15営業日）
- **目標**: 基本プラグインの実装（basemap、shapes、locations、routes、propertyresolver、project、folder）
- **成果物**: 動作する各プラグイン、UIコンポーネント、サンプルアプリケーション
- **担当**: フロントエンド開発主導、バックエンド開発支援

## 週次計画

### Week 1: Resources系プラグイン基礎
- **目標**: basemap、shapesプラグインの実装
- **成果物**: 地図表示基盤プラグイン

### Week 2: Resources系プラグイン拡張
- **目標**: locations、routes、propertyresolverプラグインの実装
- **成果物**: 地図データ管理プラグイン

### Week 3: Projects系と共通プラグイン
- **目標**: project、folderプラグインの実装と統合
- **成果物**: 完全動作するプラグインセット

## 日次タスク

### Week 1: Resources系プラグイン基礎

#### Day 36 (TASK-0036): 既存NodeTypeRegistry拡張

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001 🟢
- **依存タスク**: Phase 2完了
- **実装詳細**:
  - 既存の`packages/worker/src/registry/NodeTypeRegistry.ts`を拡張
  - UnifiedPluginDefinition対応追加
  - シングルトンパターン実装
  - React Router統合機能追加
- **テスト要件**:
  - [ ] 既存テストの継続動作
  - [ ] 新機能のテスト追加
  - [ ] 後方互換性確認
- **完了条件**:
  - [ ] 既存コードとの統合
  - [ ] UnifiedPluginDefinition対応

#### Day 37 (TASK-0037): BaseMapプラグイン - エンティティ定義

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.1 🟢
- **依存タスク**: TASK-0036
- **実装詳細**:
  ```typescript
  // packages/plugins/basemap/src/types/BaseMapEntity.ts
  export interface BaseMapEntity extends BaseEntity {
    nodeId: TreeNodeId;
    name: string;
    description?: string;
    mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
    center: [number, number]; // [lng, lat]
    zoom: number;
    bearing: number;
    pitch: number;
  }
  ```
- **テスト要件**:
  - [ ] 型定義のコンパイル
  - [ ] エンティティ構造の検証
  - [ ] MapLibreGL互換性
- **完了条件**:
  - [ ] BaseMapEntity定義完成
  - [ ] WorkingCopy定義完成

#### Day 38 (TASK-0038): BaseMapプラグイン - EntityHandler実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004, 6.2.2.1 🟢
- **依存タスク**: TASK-0037
- **実装詳細**:
  ```typescript
  export class BaseMapHandler implements EntityHandler<BaseMapEntity, never, BaseMapWorkingCopy> {
    async createEntity(nodeId: TreeNodeId, data?: Partial<BaseMapEntity>): Promise<BaseMapEntity> {
      // 地図設定の初期化
      // デフォルト値設定
      // データベース保存
    }
  }
  ```
- **テスト要件**:
  - [ ] CRUD操作テスト
  - [ ] 地図設定の永続化
  - [ ] エラーハンドリング
- **完了条件**:
  - [ ] 全CRUD操作実装
  - [ ] Dexie統合完了

#### Day 39 (TASK-0039): BaseMapプラグイン - UIコンポーネント

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-006, 6.2.2.1 🟢
- **依存タスク**: TASK-0038
- **実装詳細**:
  - BaseMapDialog: 地図作成・編集ダイアログ
  - BaseMapPanel: 地図設定パネル
  - BaseMapForm: 地図パラメータフォーム
  - MapLibreGL統合
- **テスト要件**:
  - [ ] コンポーネントレンダリング
  - [ ] ユーザー操作テスト
  - [ ] MapLibreGL表示確認
- **UI/UX要件**:
  - [ ] ローディング状態: 地図読み込み中のスピナー表示
  - [ ] エラー表示: 地図読み込みエラー時のメッセージ
  - [ ] モバイル対応: レスポンシブデザイン（768px以下）
  - [ ] アクセシビリティ: キーボード操作対応、ARIA属性
- **完了条件**:
  - [ ] UIコンポーネント完成
  - [ ] 地図表示動作確認
  - [ ] レスポンシブ対応確認

#### Day 40 (TASK-0040): BaseMapプラグイン - 統合とライフサイクル

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003, 6.2.2.1 🟢
- **依存タスク**: TASK-0039
- **実装詳細**:
  ```typescript
  export const BaseMapUnifiedDefinition: UnifiedPluginDefinition = {
    nodeType: 'basemap',
    name: 'BaseMap',
    displayName: 'Base Map',
    entityHandler: new BaseMapHandler(),
    lifecycle: {
      afterCreate: async (nodeId, entity) => {
        // 地図リソース初期化
      },
      beforeDelete: async (nodeId) => {
        // リソースクリーンアップ
      }
    },
    routing: {
      actions: {
        'view': { component: lazy(() => import('./MapView')) },
        'edit': { component: lazy(() => import('./MapEditor')) }
      }
    }
  };
  ```
- **テスト要件**:
  - [ ] プラグイン登録テスト
  - [ ] ライフサイクル動作
  - [ ] ルーティング確認
- **完了条件**:
  - [ ] 完全なプラグイン定義
  - [ ] レジストリ登録成功

### Week 2: Resources系プラグイン拡張

#### Day 41 (TASK-0041): Shapesプラグイン - GeoJSON管理

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.3 🟢
- **依存タスク**: TASK-0040
- **実装詳細**:
  ```typescript
  export interface ShapeEntity extends BaseEntity {
    geoJsonPath: string;
    simplificationLevel: number;
    filterConditions: FilterCondition[];
    features: GeoJSON.Feature[];
  }
  ```
  - GeoJSONアップロード機能
  - 簡略化アルゴリズム
  - ベクトルタイル生成
- **テスト要件**:
  - [ ] GeoJSON解析テスト
  - [ ] 簡略化処理テスト
  - [ ] タイル生成テスト
- **完了条件**:
  - [ ] GeoJSON処理完成
  - [ ] ベクトルタイル生成

#### Day 42 (TASK-0042): Locationsプラグイン - 地点情報管理

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.4 🟢
- **依存タスク**: TASK-0041
- **実装詳細**:
  ```typescript
  export interface LocationEntity extends BaseEntity {
    locationType: 'city' | 'port' | 'airport' | 'station' | 'interchange';
    coordinates: [number, number];
    name: string;
    attributes: Record<string, any>;
  }
  ```
  - 地点タイプ別管理
  - 座標検証
  - 検索・フィルタリング
- **テスト要件**:
  - [ ] 座標バリデーション
  - [ ] 地点タイプ制約
  - [ ] 検索機能テスト
- **完了条件**:
  - [ ] 地点管理機能完成
  - [ ] 検索機能動作

#### Day 43 (TASK-0043): Routesプラグイン - 経路情報管理

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.5 🟢
- **依存タスク**: TASK-0042
- **実装詳細**:
  ```typescript
  export interface RouteEntity extends BaseEntity {
    routeType: 'sea' | 'air' | 'road' | 'rail';
    startPoint: [number, number];
    endPoint: [number, number];
    waypoints: Array<[number, number]>;
    transportMode: string;
  }
  ```
  - 経路タイプ管理
  - ウェイポイント編集
  - 経路最適化
- **テスト要件**:
  - [ ] 経路計算テスト
  - [ ] ワーキングコピー管理
  - [ ] 最適化アルゴリズム
- **完了条件**:
  - [ ] 経路管理完成
  - [ ] 編集機能動作

#### Day 44 (TASK-0044): PropertyResolverプラグイン - 変換ルール

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.6 🟢
- **依存タスク**: TASK-0043
- **実装詳細**:
  ```typescript
  export interface PropertyResolverEntity extends BaseEntity {
    mappingRules: MappingRule[];
    sourceProperty: string;
    targetProperty: string;
    transformFunction: string;
  }
  ```
  - プロパティマッピング定義
  - 変換ルールエンジン
  - GeoJSON properties正規化
- **テスト要件**:
  - [ ] マッピング動作テスト
  - [ ] 変換関数テスト
  - [ ] 複数ルール適用
- **完了条件**:
  - [ ] 変換エンジン完成
  - [ ] ルール管理UI

#### Day 45 (TASK-0045): Resources系プラグイン統合テスト

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202 🟢
- **依存タスク**: TASK-0044
- **実装詳細**:
  - 全Resources系プラグイン連携
  - データフロー確認
  - パフォーマンス測定
  - メモリ使用量確認
- **テスト要件**:
  - [ ] プラグイン間連携
  - [ ] データ整合性
  - [ ] 負荷テスト
- **完了条件**:
  - [ ] 全プラグイン動作
  - [ ] 統合テスト合格

### Week 3: Projects系と共通プラグイン

#### Day 46 (TASK-0046): Projectプラグイン - 基本実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.7 🟢
- **依存タスク**: TASK-0045
- **実装詳細**:
  ```typescript
  export interface ProjectEntity extends BaseEntity {
    selectedResources: TreeNodeId[];
    displaySettings: DisplaySettings;
    layerOrder: string[];
  }
  ```
  - Resources参照システム
  - 循環依存回避
  - プロジェクト構成管理
- **テスト要件**:
  - [ ] ツリー間参照テスト
  - [ ] 循環依存チェック
  - [ ] データ集約テスト
- **完了条件**:
  - [ ] 参照システム完成
  - [ ] 循環依存なし

#### Day 47 (TASK-0047): Projectプラグイン - リソース選択UI

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.7 🟢
- **依存タスク**: TASK-0046
- **実装詳細**:
  - Resourcesツリー表示コンポーネント
  - チェックボックス選択UI
  - リアルタイムプレビュー
  - レイヤー順序調整
- **テスト要件**:
  - [ ] ツリー表示テスト
  - [ ] 選択状態管理
  - [ ] プレビュー更新
- **UI/UX要件**:
  - [ ] ローディング状態: ツリー読み込み中のスケルトン
  - [ ] エラー表示: リソース取得失敗時の再読み込みボタン
  - [ ] モバイル対応: ドロワー式UI（768px以下）
  - [ ] アクセシビリティ: ツリー構造のARIA属性、キーボードナビゲーション
- **完了条件**:
  - [ ] 選択UI完成
  - [ ] プレビュー動作
  - [ ] アクセシビリティ確認

#### Day 48 (TASK-0048): Projectプラグイン - MapLibreGL統合表示

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.2.7 🟢
- **依存タスク**: TASK-0047
- **実装詳細**:
  - 選択リソースの集約
  - MapLibreGLレイヤー生成
  - スタイル適用
  - インタラクション実装
- **テスト要件**:
  - [ ] レイヤー統合テスト
  - [ ] スタイル適用テスト
  - [ ] パフォーマンステスト
- **完了条件**:
  - [ ] 統合地図表示
  - [ ] インタラクション動作

#### Day 49 (TASK-0049): Folderプラグイン - 汎用フォルダ機能

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-202, 6.2.1 🟢
- **依存タスク**: TASK-0048
- **実装詳細**:
  ```typescript
  export interface FolderEntity extends BaseEntity {
    folderType: 'generic';
    description?: string;
    metadata: Record<string, any>;
  }
  ```
  - Resources/Projects両対応
  - 階層構造管理
  - メタデータ管理
- **テスト要件**:
  - [ ] 両ツリー対応確認
  - [ ] 階層管理テスト
  - [ ] メタデータ処理
- **完了条件**:
  - [ ] 汎用フォルダ完成
  - [ ] 両ツリーで動作

#### Day 50 (TASK-0050): 全プラグイン統合とサンプルアプリ

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-201〜203 🟢
- **依存タスク**: TASK-0049
- **実装詳細**:
  - 全プラグイン統合
  - サンプルアプリケーション作成
  - 使用例ドキュメント
  - デモデータ準備
- **テスト要件**:
  - [ ] 全プラグイン連携
  - [ ] サンプル動作確認
  - [ ] エンドツーエンド
- **完了条件**:
  - [ ] サンプルアプリ完成
  - [ ] デモ可能状態

## フェーズ完了基準

- [ ] 全タスクが完了している (15/15)
- [ ] 8つのプラグインが動作
- [ ] Resources/Projectsツリー連携
- [ ] MapLibreGL統合完了
- [ ] UIコンポーネント完成
- [ ] サンプルアプリケーション動作

## 次フェーズへの引き継ぎ事項

- プラグイン実装パターン
- UI/UXガイドライン
- MapLibreGL統合方法
- ツリー間参照パターン
- パフォーマンス最適化ポイント

## プラグイン一覧と状態

| プラグイン | ツリー | 状態 | 主要機能 |
|-----------|--------|------|----------|
| basemap | Resources | [ ] | MapLibreGL基本地図 |
| shapes | Resources | [ ] | GeoJSON/ベクトルタイル |
| locations | Resources | [ ] | 地点情報管理 |
| routes | Resources | [ ] | 経路情報管理 |
| propertyresolver | Resources | [ ] | プロパティ変換 |
| project | Projects | [ ] | リソース集約表示 |
| folder | 共通 | [ ] | 汎用フォルダ |

## リスクと対策

| リスク | 対策 | 状態 |
|--------|------|------|
| MapLibreGL統合 | 早期プロトタイプ | 🟡 |
| プラグイン間依存 | プライオリティ管理 | 🟢 |
| UI/UX一貫性 | デザインシステム | 🟡 |

## 振り返り記入欄

### 計画との差異
- （Phase完了時に記入）

### 学習事項
- （Phase完了時に記入）

### 改善点
- （Phase完了時に記入）