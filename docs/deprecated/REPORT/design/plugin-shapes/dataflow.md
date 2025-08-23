# Plugin Shapes データフロー図

## 概要

本ドキュメントでは、Shapesプラグインにおける各種データフローを詳細に図解します。特にWebWorkerによるバッチ処理とベクトルタイル生成の複雑なフローに焦点を当てます。

**【信頼性レベル】**: 🟡 hierarchidbアーキテクチャパターンとeria-cartographの処理フローから妥当な推測

## 1. メインユーザーインタラクションフロー

### 基本CRUD操作フロー 🟢

```mermaid
flowchart TD
    A[ユーザー操作] --> B{操作種別}
    B -->|作成| C[ShapesEditor.tsx]
    B -->|読み取り| D[ShapesViewer.tsx] 
    B -->|更新| E[ShapesEditor.tsx]
    B -->|削除| F[ConfirmDialog.tsx]
    
    C --> G[Working Copy作成]
    D --> H[エンティティ取得]
    E --> I[Working Copy編集]
    F --> J[削除確認]
    
    G --> K[Comlink RPC]
    H --> K
    I --> K
    J --> K
    
    K --> L[ShapesEntityHandler]
    L --> M{ストレージ選択}
    M -->|永続化| N[CoreDB]
    M -->|一時保存| O[EphemeralDB]
    
    N --> P[BaseMap連携更新]
    O --> Q[プレビュー更新]
    P --> R[UI反映]
    Q --> R
```

### GeoJSONインポートフロー 🟡

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as ShapesImporter.tsx
    participant V as FileValidator
    participant W as ImportWorker
    participant H as ShapesHandler
    participant DB as Database
    
    U->>UI: ファイル選択
    UI->>V: ファイル検証
    V-->>UI: 検証結果
    
    alt 検証成功
        UI->>W: インポート開始
        W->>W: GeoJSON解析
        W->>W: 座標系検出・変換
        W->>W: データ検証
        W->>UI: 進行状況通知
        W->>H: エンティティ作成
        H->>DB: データ保存
        DB-->>H: 保存完了
        H-->>W: 作成完了
        W-->>UI: インポート完了
        UI-->>U: 成功メッセージ + プレビュー
    else 検証失敗
        V-->>UI: エラー詳細
        UI-->>U: エラーメッセージ + 修正提案
    end
```

## 2. WebWorkerバッチ処理フロー

### 並行ダウンロード処理 🟡

```mermaid
flowchart TD
    A[BatchProcessor.tsx] --> B[バッチタスク作成]
    B --> C[WebWorker起動]
    
    C --> D[TaskQueue初期化]
    D --> E[並行実行管理<br/>最大4Worker]
    
    E --> F[Worker 1<br/>URL-A処理]
    E --> G[Worker 2<br/>URL-B処理]
    E --> H[Worker 3<br/>URL-C処理]
    E --> I[Worker 4<br/>URL-D処理]
    
    F --> J[HTTP Fetch]
    G --> J
    H --> J
    I --> J
    
    J --> K{レスポンス状態}
    K -->|成功| L[データ検証]
    K -->|失敗| M[リトライ処理<br/>最大3回]
    
    L --> N[座標系変換]
    M --> O{リトライ回数}
    O -->|上限未満| J
    O -->|上限到達| P[失敗記録]
    
    N --> Q[統合処理]
    P --> Q
    Q --> R[進行状況更新]
    R --> S[UI通知]
    
    Q --> T{全タスク完了?}
    T -->|未完了| E
    T -->|完了| U[結果統合]
    U --> V[データベース保存]
```

### バッチ処理メッセージフロー 🟡

```mermaid
sequenceDiagram
    participant UI as BatchProcessor UI
    participant MW as MainWorker
    participant BW as BatchWorker[]
    participant EXT as External APIs
    participant DB as Database
    
    UI->>MW: BatchDownloadMessage
    MW->>MW: TaskQueue作成
    
    par Worker 1
        MW->>BW: URL-A 処理開始
        BW->>EXT: fetch(URL-A)
        EXT-->>BW: GeoJSON Data A
        BW->>BW: 検証・変換処理
        BW-->>MW: ProcessingProgress (25%)
        MW-->>UI: Progress Update
    and Worker 2
        MW->>BW: URL-B 処理開始
        BW->>EXT: fetch(URL-B)
        EXT-->>BW: GeoJSON Data B
        BW->>BW: 検証・変換処理
        BW-->>MW: ProcessingProgress (50%)
        MW-->>UI: Progress Update
    and Worker 3
        MW->>BW: URL-C 処理開始
        BW->>EXT: fetch(URL-C)
        EXT->>BW: Network Error
        BW->>BW: リトライ処理
        BW->>EXT: retry fetch(URL-C)
        EXT-->>BW: GeoJSON Data C
        BW-->>MW: ProcessingProgress (75%)
        MW-->>UI: Progress Update
    end
    
    MW->>MW: 結果統合処理
    MW->>DB: 統合データ保存
    MW-->>UI: ProcessingComplete
```

## 3. ベクトルタイル生成フロー

### QuadTreeアルゴリズム処理 🔴

```mermaid
flowchart TD
    A[ShapesEntity] --> B[GeoJSON抽出]
    B --> C[空間範囲計算<br/>BoundingBox]
    C --> D[QuadTree初期化]
    
    D --> E[Root Node作成]
    E --> F[Feature分散処理]
    
    F --> G{Feature数}
    G -->|閾値以下| H[Leaf Node作成]
    G -->|閾値超過| I[4分割実行]
    
    I --> J[NW Quadrant]
    I --> K[NE Quadrant]
    I --> L[SW Quadrant]
    I --> M[SE Quadrant]
    
    J --> N[再帰処理]
    K --> N
    L --> N
    M --> N
    
    N --> O{最大深度?}
    O -->|未到達| F
    O -->|到達| P[階層構造完成]
    
    H --> Q[ズームレベル計算]
    P --> Q
    Q --> R[タイル座標生成]
```

### ズームレベル別タイル生成 🟡

```mermaid
sequenceDiagram
    participant VG as VectorTileGenerator
    participant QT as QuadTree
    participant SP as SimplificationProcessor
    participant CP as ClippingProcessor
    participant MC as MVTConverter
    participant CC as CompressionController
    
    VG->>QT: getZoomLevelData(zoom)
    QT-->>VG: TileGrid[]
    
    loop 各タイルについて
        VG->>SP: simplifyGeometry(features, tolerance)
        SP-->>VG: SimplifiedFeatures
        
        VG->>CP: clipToBounds(features, tileBounds)
        CP-->>VG: ClippedFeatures
        
        VG->>MC: convertToMVT(features, tileCoord)
        MC-->>VG: MVTBuffer
        
        VG->>CC: compressData(mvtBuffer)
        CC-->>VG: CompressedBuffer
        
        VG->>VG: storeTileCache(tileKey, data)
    end
    
    VG->>VG: generateTileManifest()
```

## 4. 座標系変換フロー

### 自動座標系検出・変換 🟡

```mermaid
flowchart LR
    A[GeoJSON Input] --> B[CRS検出]
    B --> C{座標系判定}
    
    C -->|WGS84| D[変換不要]
    C -->|Web Mercator| E[WGS84変換]
    C -->|UTM| F[UTM→WGS84変換]
    C -->|不明| G[座標値解析]
    
    G --> H{座標範囲判定}
    H -->|±180,±90以内| I[WGS84推定]
    H -->|範囲外| J[投影座標系推定]
    
    E --> K[Proj4js変換]
    F --> K
    I --> L[変換完了]
    J --> M[ユーザー確認要求]
    K --> L
    
    L --> N[変換後検証]
    N --> O[バウンディングボックス更新]
    M --> P[手動座標系指定]
    P --> K
```

## 5. BaseMap連携データフロー

### レイヤー統合フロー 🟡

```mermaid
sequenceDiagram
    participant S as ShapesPlugin
    participant B as BaseMapPlugin
    participant M as MapLibre GL JS
    participant C as StyleCache
    
    S->>B: addShapesLayer(shapesId, layerConfig)
    B->>S: getShapesData(shapesId)
    S-->>B: GeoJSON + StyleConfig
    
    B->>C: generateMapLibreStyle(geojson, style)
    C-->>B: MapLibreStyleSpec
    
    B->>M: addSource(sourceId, geojsonData)
    B->>M: addLayer(layerSpec)
    M-->>B: Layer Added
    
    B->>B: updateLayerRegistry(shapesId, layerId)
    B-->>S: Integration Complete
    
    Note over S,M: 以降はリアルタイム更新
    
    S->>B: updateShapesLayer(shapesId, newData)
    B->>M: getSource(sourceId).setData(newData)
    M->>M: Re-render Map
```

### ベクトルタイル統合フロー 🔴

```mermaid
flowchart TD
    A[ベクトルタイル生成完了] --> B[タイルサーバー準備]
    B --> C[BaseMap統合準備]
    
    C --> D[Vector Source作成]
    D --> E[タイルURL生成]
    E --> F[MapLibre Source登録]
    
    F --> G[レイヤースタイル適用]
    G --> H[ズームレベル制御]
    H --> I[表示優先度設定]
    
    I --> J[地図レンダリング]
    J --> K[パフォーマンス監視]
    K --> L{パフォーマンス OK?}
    
    L -->|良好| M[ユーザー表示]
    L -->|劣化| N[タイル簡素化]
    N --> O[キャッシュ最適化]
    O --> J
```

## 6. エラーハンドリングフロー

### 多層エラー処理 🟡

```mermaid
flowchart TD
    A[操作実行] --> B{エラー発生?}
    B -->|なし| C[正常完了]
    B -->|あり| D[エラー種別判定]
    
    D --> E{ネットワークエラー}
    D --> F{データエラー}
    D --> G{システムエラー}
    D --> H{Worker エラー}
    
    E --> I[リトライ処理]
    I --> J{リトライ回数}
    J -->|上限未満| K[再実行]
    J -->|上限到達| L[オフライン対応]
    
    F --> M[データ検証]
    M --> N[修復可能性判定]
    N -->|修復可能| O[自動修復]
    N -->|修復不可| P[ユーザー通知]
    
    G --> Q[システム状態確認]
    Q --> R[リソース解放]
    R --> S[安全な状態復旧]
    
    H --> T[Worker再起動]
    T --> U[処理状態復元]
    U --> V[処理継続]
    
    K --> A
    L --> W[ローカル動作モード]
    O --> C
    P --> X[エラーレポート]
    S --> Y[ユーザー通知]
    V --> A
    
    W --> Z[UI更新]
    X --> Z
    Y --> Z
```

### Working Copy競合解決 🟢

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant WM as WorkingCopyManager
    participant DB as EphemeralDB
    participant CD as ConflictDetector
    
    U1->>WM: createWorkingCopy(entityId)
    WM->>DB: create working_copy_1
    WM-->>U1: Working Copy Created
    
    U2->>WM: createWorkingCopy(entityId)
    WM->>CD: checkExistingCopies(entityId)
    CD-->>WM: Existing copy found
    WM-->>U2: Conflict: Read-only access
    
    U1->>WM: updateWorkingCopy(changes)
    WM->>DB: update working_copy_1
    
    U1->>WM: commitWorkingCopy()
    WM->>DB: apply changes to core entity
    WM->>DB: delete working_copy_1
    WM-->>U2: Conflict resolved: Edit access available
    
    U2->>WM: createWorkingCopy(entityId)
    WM->>DB: create working_copy_2
    WM-->>U2: Working Copy Created
```

## 7. キャッシュ・最適化フロー

### 多層キャッシュ戦略 🟡

```mermaid
flowchart LR
    A[データ要求] --> B{L1: メモリキャッシュ}
    B -->|Hit| C[即座に返却]
    B -->|Miss| D{L2: IndexedDBキャッシュ}
    
    D -->|Hit| E[非同期読み込み]
    D -->|Miss| F{L3: ベクトルタイルキャッシュ}
    
    F -->|Hit| G[タイル結合処理]
    F -->|Miss| H[フルデータ生成]
    
    E --> I[メモリキャッシュ更新]
    G --> I
    H --> J[全キャッシュ更新]
    
    I --> K[データ返却]
    J --> K
    
    K --> L[TTL管理開始]
    L --> M[バックグラウンド更新]
```

この詳細なデータフロー設計により、複雑な地理空間データ処理を効率的かつ安全に実行し、優れたユーザー体験を提供します。