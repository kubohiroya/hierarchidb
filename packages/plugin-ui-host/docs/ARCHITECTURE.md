# Plugin Dialog Architecture

## 概要

HierarchiDBのプラグインダイアログシステムは、プラグインが独自のUI・検証ロジック・バッチ処理機能を提供できる拡張可能なマルチステップダイアログフレームワークです。

## アーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer (React)                  │
│  ┌─────────────────────────────────────────────┐    │
│  │            Jotai Atoms (State)              │    │
│  │  • draftAtom                          │    │
│  │  • dialogStateAtom                          │    │
│  │  • validationResultsAtom                    │    │
│  │  • stepCapabilitiesAtom                     │    │
│  └─────────────────────────────────────────────┘    │
│                        ↕️                             │
│  ┌─────────────────────────────────────────────┐    │
│  │         useWorkerSync Hook                  │    │
│  │  • Auto validation on data change           │    │
│  │  • Capabilities evaluation                  │    │
│  │  • Debounced requests (100ms)               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                        ↕️ Comlink RPC
┌─────────────────────────────────────────────────────┐
│                 Worker Layer                         │
│  ┌─────────────────────────────────────────────┐    │
│  │         WorkerBridge Service                │    │
│  │  • Batch validation                         │    │
│  │  • Batch capabilities evaluation            │    │
│  │  • MessageChannel for notifications         │    │
│  └─────────────────────────────────────────────┘    │
│                        ↕️                             │
│  ┌─────────────────────────────────────────────┐    │
│  │      Plugin Validation Logic                │    │
│  │  • Database access (EphemeralDB)            │    │
│  │  • Heavy computations                       │    │
│  │  • Business rules                           │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## 主要コンポーネント

### 1. PluginDialog Components

#### PluginDialog
基本的なマルチステップダイアログ機能を提供。

#### PluginDialogEnhanced
フルスクリーンモードでの自動開閉機能を追加。
- ヘッダー（Stepper）: 3秒間操作がないと自動的に隠れる
- フッター（Actions）: 同様に自動開閉
- バッチ処理対応: 任意のステップから「Start Batch」ボタンを表示可能

#### DialogStepper
ステップナビゲーションコンポーネント。
- 各ステップボタンはダイレクトリンクとして機能
- `canNavigateTo`関数で遷移可否を判定

### 2. Step Capabilities API

プラグインは各ステップで以下の検証関数を提供できます：

```typescript
export interface StepCapabilities {
  /** Whether this step can be navigated to directly */
  canNavigateTo: (fromStep: number, data: any) => boolean | Promise<boolean>;
  
  /** Whether build processing can start from this step */
  canStartBatch: (data: any) => boolean | Promise<boolean>;
  
  /** Whether the dialog can be saved and closed from this step */
  canSave: (data: any) => boolean | Promise<boolean>;
  
  /** Whether can proceed to next step */
  canProceedToNext: (data: any) => boolean | Promise<boolean>;
  
  /** Whether can go back to previous step */
  canBackToPrevious: (data: any) => boolean | Promise<boolean>;
}
```

### 3. URL構造とダイレクトリンク

```
/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action
```

#### 具体例

##### 新規作成（create）
```
/t/tree-001/node-123/550e8400-e29b-41d4-a716-446655440000/shape/create/normal/2
```
- `550e8400-e29b-41d4-a716-446655440000`: 事前採番されたワーキングコピーID（UUID）
- `create`: 新規作成アクション
- `/normal/2`: 通常表示モードでステップ2を表示（1ベースのインデックス）

##### 編集（edit）
```
/t/tree-001/node-456/abc12345-def6-7890-ghij-klmnopqrstuv/spreadsheet/edit/normal/3
```
- 既存ノードのワーキングコピーIDを使用
- `edit`: 編集アクション

##### 地図の初期位置指定
```
/t/tree-001/node-789/def45678-9012-3456-7890-abcdefghijkl/basemap/create/normal/1?zxy=10,139.7,35.6
```
- `zxy=10,139.7,35.6`: ズームレベル10、経度139.7度、緯度35.6度

## 状態管理

### Jotai Atoms

#### 基本Atoms
- `draftAtom`: 現在のワーキングコピーデータ
- `dialogStateAtom`: ダイアログのナビゲーション状態
- `validationResultsAtom`: 各ステップのバリデーション結果
- `stepCapabilitiesAtom`: 各ステップの能力評価結果

#### 派生Atoms
- `canSaveAtom`: 保存可能かどうか
- `canStartBatchAtom`: バッチ開始可能かどうか
- `canGoNextAtom`: 次へ進めるかどうか
- `canGoPreviousAtom`: 前へ戻れるかどうか

### データ永続化戦略

| データ種別 | 保存場所 | 永続性 | 理由 |
|----------|---------|--------|------|
| ワーキングコピー本体 | EphemeralDB (Worker側) | ブラウザセッション中 | Single Source of Truth |
| 現在のステップ番号 | URL Query Parameter | URL維持中 | ダイレクトリンク対応 |
| ダイアログ状態 | Jotai Atoms (メモリ) | コンポーネント生存中 | リアクティブUI |
| バリデーション結果 | Jotai Atoms (メモリ) | リアルタイム更新用 | 即座のフィードバック |

**注意**: sessionStorageやlocalStorageへのキャッシュは行いません。EphemeralDBが唯一の永続化層です。

## Worker通信

### WorkerBridge Service

UI層とWorker層の通信を管理：

1. **バッチ処理**: 複数のバリデーション/評価リクエストをまとめて送信
2. **デバウンス**: 100msの遅延でリクエストを集約
3. **MessageChannel**: 双方向のリアルタイム通信
4. **Comlink RPC**: 透過的な関数呼び出し

### 通信フロー

```typescript
// 1. データ変更
onChange(newData) 
  ↓
// 2. Jotai atom更新
updateDraftAtom(newData)
  ↓
// 3. useWorkerSync内で検知
queueValidation({ stepId, data })
  ↓
// 4. 100ms後にバッチ処理
Worker.batchValidate(requests)
  ↓
// 5. MessageChannel経由で通知
setValidationResultAtom(result)
  ↓
// 6. UIが自動的に再レンダリング
```

## プラグイン実装例

### Step Provider

```typescript
export class SamplePluginProvider implements PluginStepProvider {
  nodeType = 'sample';

  getCreateSteps(): DialogStep[] {
    return [
      {
        id: 'configuration',
        label: 'Configuration',
        component: <ConfigurationStep />,
        capabilities: {
          canNavigateTo: (fromStep, data) => true,
          canProceedToNext: (data) => !!data?.setting1?.trim(),
          canBackToPrevious: (data) => true,
          canSave: (data) => !!data?.setting1?.trim(),
          canStartBatch: (data) => false,
        }
      },
      {
        id: 'build-config',
        label: 'Batch Configuration',
        optional: true,
        capabilities: {
          canNavigateTo: (fromStep, data) => !!data?.setting1?.trim(),
          canProceedToNext: (data) => data?.batchSize > 0,
          canBackToPrevious: (data) => !data?.batchRunning,
          canSave: (data) => true,
          canStartBatch: (data) => {
            return data?.batchSize > 0 && data?.batchSize <= 1000;
          }
        }
      }
    ];
  }
}
```

### 使用方法

```typescript
// プラグインの登録
const registry = PluginStepRegistry.getInstance();
registry.register(new SamplePluginProvider());

// ダイアログの使用
<PluginDialogWithJotai
  nodeId={nodeId}
  treeId={treeId}
  nodeType="sample"
  mode="create"
  open={true}
  onClose={handleClose}
  onSuccess={handleSuccess}
/>
```

## 特殊機能

### バッチ処理

バッチ処理対応ダイアログでは：
- 任意のステップから「Start Batch」ボタンを表示
- `canStartBatch`関数の結果に基づいて有効/無効を制御
- 最終ステップ以外でもバッチを開始可能

### フルスクリーンモード

`PluginDialogEnhanced`使用時：
- ヘッダー/フッターが自動的に隠れる（3秒後）
- マウス移動で再表示
- 手動での表示/非表示切り替え可能

### ワーキングコピーの永続性

- URLに含まれるUUIDでワーキングコピーを識別
- ブラウザをリロードしても編集を再開可能
- EphemeralDBに永続化（ブラウザセッション中）
- 編集完了またはキャンセルで自動削除

## パフォーマンス最適化

1. **バッチ処理**: 複数のバリデーションを一括実行
2. **デバウンス**: 頻繁な変更を100-300msで集約
3. **メモ化**: Jotaiの派生Atomsで計算結果をキャッシュ
4. **並列評価**: Promise.allで複数のcapabilitiesを並列実行
5. **Worker分離**: 重い処理をWorker側で実行

## エラーハンドリング

### Worker切断時
- ローカルのJotai状態で継続可能
- 再接続時に自動同期

### バリデーションエラー
- ステップごとにエラーメッセージを表示
- エラーがある間はナビゲーションを制限

### 保存エラー
- エラーダイアログを表示
- ワーキングコピーは保持（再試行可能）

## セキュリティ考慮事項

1. **権限チェック**: `validateAccess`でノードへのアクセス権を確認
2. **データ検証**: Worker側で厳密なバリデーション
3. **XSS防止**: Reactの自動エスケープ
4. **CSRF対策**: Comlink RPCの使用

## 今後の拡張予定

- [ ] オフライン対応（Service Worker統合）
- [ ] リアルタイムコラボレーション
- [ ] ステップ間の依存関係グラフ
- [ ] プログレッシブエンハンスメント
- [ ] アクセシビリティ強化（ARIA対応）
