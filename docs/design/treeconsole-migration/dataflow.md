# TreeConsole Migration データフロー図

## 🟢 データフロー概要

TreeConsoleの移植において、既存のデータフロー構造を維持しながら、新しいWorkerAPIとの適合を図る。

**信頼性レベル**: 🟢 青信号 - 既存実装のデータフローを参考

## 🟢 1. コンポーネント階層フロー

既存TreeConsoleのコンポーネント構造をそのまま移植

```mermaid
flowchart TD
    A[TreeConsole] --> B[TreeTableConsolePanel]
    B --> C[TreeConsoleHeader]
    B --> D[TreeConsoleToolbar]
    B --> E[TreeConsoleContent]
    B --> F[TreeConsoleFooter]
    B --> G[TreeConsoleActions]
    
    C --> C1[TreeConsoleBreadcrumb]
    D --> D1[TreeConsoleToolbarContent]
    E --> E1[TreeTableVirtualized]
    E --> E2[TreeConsoleContentErrorBoundary]
```

## 🟡 2. データ取得フロー（API適合）

新しいWorkerAPIとの適合レイヤーを通じたデータ取得

**信頼性レベル**: 🟡 黄信号 - 新旧API差異の変換

```mermaid
sequenceDiagram
    participant UI as TreeConsole
    participant Hook as useTreeViewController
    participant Adapter as WorkerAPIAdapter
    participant API as WorkerAPI
    participant Worker as @hierarchidb/worker
    
    UI->>Hook: useTreeViewController({nodeId})
    Hook->>Adapter: subscribeToSubtree(nodeId)
    Adapter->>API: observeSubtree(CommandEnvelope)
    API->>Worker: Comlink RPC Call
    Worker-->>API: Observable<TreeChangeEvent>
    API-->>Adapter: Observable<TreeChangeEvent>
    Adapter-->>Hook: Callback-style subscription
    Hook-->>UI: TreeViewController state
```

## 🟢 3. ユーザー操作フロー

既存の操作フローを維持

**信頼性レベル**: 🟢 青信号 - 既存実装の操作フローを移植

```mermaid
flowchart TD
    A[ユーザー操作] --> B{操作タイプ}
    
    B -->|ノード選択| C[setRowSelection]
    B -->|ドラッグ開始| D[onDragStart]
    B -->|ドロップ完了| E[moveNodes]
    B -->|右クリック| F[openContextMenu]
    B -->|キーボード| G[handleKeyDown]
    
    C --> H[状態更新]
    D --> I[draggingNodeId設定]
    E --> J[WorkerAPIAdapter.moveNodes]
    F --> K[アクションメニュー表示]
    G --> L[ショートカット処理]
    
    J --> M[CommandEnvelope生成]
    M --> N[WorkerAPI.moveNodes]
    N --> O[Worker実行]
    O --> P[Observable通知]
    P --> Q[UI更新]
```

## 🟡 4. 状態管理フロー

既存のuseTreeViewControllerを中心とした状態管理

**信頼性レベル**: 🟡 黄信号 - APIアダプターによる適合が必要

```mermaid
flowchart LR
    A[useTreeViewController] --> B[TreeView State]
    A --> C[WorkerAPIAdapter]
    
    B --> B1[rowSelection]
    B --> B2[expandedNodes]
    B --> B3[currentNode]
    B --> B4[nodePath]
    B --> B5[isLoading]
    
    C --> C1[subscribeToSubtree]
    C --> C2[moveNodes]
    C --> C3[deleteNodes]
    C --> C4[createWorkingCopy]
    C --> C5[commitWorkingCopy]
    
    C1 --> D[WorkerAPI.observeSubtree]
    C2 --> E[WorkerAPI.moveNodes]
    C3 --> F[WorkerAPI.moveToTrash]
    C4 --> G[WorkerAPI.createWorkingCopy]
    C5 --> H[WorkerAPI.commitWorkingCopy]
```

## 🟢 5. Drag & Drop フロー

既存のreact-dndとDnDコンテキストを活用

**信頼性レベル**: 🟢 青信号 - 既存DnD実装を移植

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Row as TreeTableRow
    participant Context as DnDContext
    participant Hook as useTreeViewController
    participant Adapter as WorkerAPIAdapter
    participant API as WorkerAPI
    
    User->>Row: ドラッグ開始
    Row->>Context: setDraggingNodeId
    Context->>Hook: onDragStateChange
    Hook->>Hook: draggingNodeId状態更新
    
    User->>Row: ドロップ
    Row->>Hook: handleDrop
    Hook->>Adapter: moveNodes(nodeIds, targetId)
    Adapter->>API: moveNodes(CommandEnvelope)
    API-->>Adapter: CommandResult
    Adapter-->>Hook: Promise<void>
    Hook->>Context: setDraggingNodeId(undefined)
```

## 🟡 6. Working Copy パターンフロー

新しいWorkerAPIのWorking Copy機能への適合

**信頼性レベル**: 🟡 黄信号 - 新APIへの適合が必要

```mermaid
flowchart TD
    A[ノード編集開始] --> B{編集タイプ}
    
    B -->|新規作成| C[createWorkingCopyForCreate]
    B -->|既存編集| D[createWorkingCopy]
    
    C --> E[フォーム表示]
    D --> E
    
    E --> F[ユーザー編集]
    F --> G{保存・破棄}
    
    G -->|保存| H[commitWorkingCopy]
    G -->|破棄| I[discardWorkingCopy]
    
    H --> J[WorkingCopy → CoreDB]
    I --> K[Working Copy削除]
    
    J --> L[TreeChangeEvent発行]
    K --> L
    L --> M[Observable通知]
    M --> N[UI更新]
```

## 🟢 7. エラーハンドリングフロー

既存のエラーバウンダリーとエラーハンドリングを移植

**信頼性レベル**: 🟢 青信号 - REQ-104, EDGE-003に基づく既存実装

```mermaid
flowchart TD
    A[操作実行] --> B{エラー発生?}
    
    B -->|正常| C[成功レスポンス]
    B -->|エラー| D{エラー種別}
    
    D -->|Worker通信失敗| E[読み取り専用モード]
    D -->|バリデーションエラー| F[エラーメッセージ表示]
    D -->|ネットワークエラー| G[リトライ機能]
    D -->|レンダリングエラー| H[ErrorBoundary]
    
    E --> I[キャッシュデータ表示]
    F --> J[Snackbar通知]
    G --> K[自動リトライ]
    H --> L[フォールバックUI]
    
    I --> M[オフラインモード表示]
    J --> N[ユーザー操作継続]
    K --> O[再接続試行]
    L --> P[最小限機能提供]
```

## 🟡 8. パフォーマンス最適化フロー

仮想化とメモ化による最適化

**信頼性レベル**: 🟡 黄信号 - NFR-001, NFR-002から推測

```mermaid
flowchart LR
    A[大量データ] --> B[TanStack Virtual]
    B --> C[可視範囲計算]
    C --> D[DOM要素最小化]
    
    E[コンポーネント更新] --> F[React.memo]
    F --> G[Props比較]
    G --> H[再レンダリング抑制]
    
    I[計算処理] --> J[useMemo]
    J --> K[依存配列チェック]
    K --> L[キャッシュ活用]
    
    M[イベントハンドラー] --> N[useCallback]
    N --> O[関数参照安定化]
    O --> P[子コンポーネント最適化]
```

## 🟢 まとめ

このデータフローは既存TreeConsole実装を最大限活用し、WorkerAPIAdapterレイヤーで新旧APIの差異のみを吸収する設計です。ユーザー体験と既存の操作フローを維持しながら、新しいWorkerAPIの恩恵を受けることができます。