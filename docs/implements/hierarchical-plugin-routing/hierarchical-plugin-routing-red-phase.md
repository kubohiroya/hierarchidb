# 階層的プラグインルーティングシステム - Red Phase 設計

## Red Phase 実装内容

### 作成日時
2025-01-15 00:01

### テストファイル構造

```
packages/ui-routing/src/plugins/
├── HierarchicalPluginRouter.test.ts  # メインテストファイル
├── HierarchicalPluginRouter.ts       # 実装ファイル (未作成)
└── types.ts                          # TypeScript型定義
```

### テストケース設計

#### 1. URL解析機能テスト
- **意図**: React Routerの階層的URLパターンの解析機能を検証
- **カバー範囲**: 
  - 完全階層URL (`/t/tree-123/node-456/node-789/basemap/edit`)
  - 最小URL (`/t/tree-123`)
  - 無効URL (空パラメータ)

#### 2. プラグインレジストリテスト
- **意図**: プラグイン登録・取得システムの機能を検証
- **カバー範囲**:
  - プラグイン定義の登録
  - 登録済みプラグインの取得
  - 未登録プラグインのエラーハンドリング

#### 3. 動的ロード機能テスト
- **意図**: Code Splittingによる動的コンポーネントロードを検証
- **カバー範囲**:
  - React.lazyコンポーネントの動的ロード
  - React.Suspenseとの統合
  - 存在しないプラグインでの404エラー

#### 4. 階層情報統合テスト
- **意図**: useLoaderDataによるデータ統合機能を検証
- **カバー範囲**:
  - ツリーコンテキストの統合
  - ターゲットノード情報の取得
  - プラグイン固有データの統合
  - 無効リソースIDでのエラーハンドリング

#### 5. 権限チェックテスト
- **意図**: アクセス制御システムの機能を検証
- **カバー範囲**:
  - 権限不足時の403エラー
  - 適切な権限でのアクセス許可

#### 6. パフォーマンステスト
- **意図**: システムのパフォーマンス要件（<100ms）を検証
- **カバー範囲**:
  - ルート解決処理の実行時間測定

### 期待される失敗パターン

```typescript
// 1. モジュール解決エラー
Cannot resolve module './HierarchicalPluginRouter'

// 2. 未定義関数呼び出しエラー
parseHierarchicalUrl is not defined
PluginRegistry is not defined
loadPluginComponent is not defined

// 3. クラス未定義エラー
HierarchicalPluginRouter is not defined
```

### 実装要求仕様

#### Core Classes/Functions

1. **parseHierarchicalUrl(url: string): PluginRouteParams**
   - 階層URLの解析
   - オプショナルパラメータの処理
   - エラーハンドリング

2. **PluginRegistry (Static Class)**
   - `register(plugin: PluginDefinition): void`
   - `get(nodeType: string): PluginDefinition | undefined`
   - `clear(): void`

3. **loadPluginComponent(nodeType: string, action: string): ComponentType**
   - 動的コンポーネントローダー
   - React.lazyとの統合
   - エラーハンドリング

4. **HierarchicalPluginRouter (Main Class)**
   - `loadHierarchicalData(params: PluginRouteParams): Promise<HierarchicalRouteData>`
   - `checkPermissions(params: PluginRouteParams): Promise<PermissionCheckResult>`
   - `resolveRoute(params: PluginRouteParams): Promise<void>`

### TypeScript型定義

以下の型定義がすでに`types.ts`に実装済み：
- `PluginRouteParams`
- `PluginAction`
- `PluginDefinition`
- `HierarchicalRouteData`
- `TreeData` / `TreeNodeData`
- `PermissionCheckResult`

### テスト環境要件

現在の`ui-routing`パッケージに以下が不足：
- Vitest設定
- React Testing Library
- テスト実行スクリプト

追加が必要な依存関係：
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

### Green Phase実装ガイドライン

#### 実装優先順位
1. **基本URL解析** - `parseHierarchicalUrl`
2. **プラグインレジストリ** - `PluginRegistry`  
3. **エラーハンドリング基盤**
4. **動的コンポーネントローダー**
5. **データ統合機能**
6. **権限チェック機能**

#### 最小実装アプローチ
- モック・スタブ実装でテスト通過を優先
- 詳細なロジックはRefactorフェーズで改善
- エラーハンドリングは基本的なthrowで実装

#### 品質基準
- TypeScript型安全性の確保
- React統合の正確性
- パフォーマンス要件の満足
- エラーハンドリングの網羅