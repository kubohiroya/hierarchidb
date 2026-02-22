# Plugin Shapes API エンドポイント仕様

## 概要

Shapesプラグインの API エンドポイント設計です。hierarchidbの階層的ルーティングシステムとWebWorker通信パターンに準拠します。

**【信頼性レベル】**: 🟢 hierarchidbアーキテクチャ標準 + 🟡 BaseMapプラグインパターンから妥当な推測 + 🔴 eria-cartographパターンからの推測

## ベースURL構造

```
/t/:treeId/:pageNodeId/:targetNodeId/shapes
```

### パラメータ説明 🟢
- `treeId`: プロジェクトツリーID
- `pageNodeId`: 現在表示中のページノードID  
- `targetNodeId`: 対象Shapesエンティティのノード ID
- `shapes`: プラグイン識別子

## エンドポイント一覧

### 1. Shapes管理エンドポイント

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes
**Shapes情報取得**

**Request:**
```http
GET /t/proj-001/page-main/shapes-tokyo/shapes
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeId": "shapes-tokyo",
    "name": "Tokyo Districts",
    "description": "Administrative districts of Tokyo",
    "geojson": {
      "type": "FeatureCollection",
      "features": [...]
    },
    "layerConfig": {
      "visible": true,
      "opacity": 0.8,
      "zIndex": 10,
      "interactive": true
    },
    "defaultStyle": {
      "polygon": {
        "fillColor": "#3388ff",
        "fillOpacity": 0.6,
        "strokeColor": "#0066cc",
        "strokeWidth": 2
      }
    },
    "stats": {
      "featureCount": 23,
      "totalVertices": 1250,
      "dataSize": 15680,
      "boundingBox": [139.6917, 35.6595, 139.7044, 35.6762]
    },
    "createdAt": 1703123456789,
    "updatedAt": 1703123456789,
    "version": 1
  },
  "meta": {
    "timestamp": 1703123456789,
    "processingTime": 15
  }
}
```

#### POST /t/:treeId/:pageNodeId/shapes
**新規Shapes作成** 🟢

**Request:**
```json
{
  "parentId": "page-main",
  "name": "New Shapes",
  "description": "Created from API",
  "geojson": {
    "type": "FeatureCollection", 
    "features": [...]
  },
  "layerConfig": {
    "visible": true,
    "opacity": 1.0,
    "zIndex": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeId": "shapes-new-001",
    "draftId": "wc-shapes-new-001-temp"
  }
}
```

#### PUT /t/:treeId/:pageNodeId/:targetNodeId/shapes  
**Shapes更新** 🟢

**Request:**
```json
{
  "name": "Updated Shapes Name",
  "layerConfig": {
    "opacity": 0.7
  },
  "defaultStyle": {
    "polygon": {
      "fillColor": "#ff6600"
    }
  }
}
```

#### DELETE /t/:treeId/:pageNodeId/:targetNodeId/shapes
**Shapes削除** 🟢

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedNodeId": "shapes-tokyo",
    "cascadeDeleted": {
      "workingCopies": 2,
      "vectorTiles": 156,
      "processingTasks": 1
    }
  }
}
```

### 2. GeoJSONインポート・エクスポートエンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/import
**GeoJSONファイルインポート** 🟡

**Request (Multipart Form):**
```http
POST /t/proj-001/page-main/shapes-tokyo/shapes/import
Content-Type: multipart/form-data

files: [file1.geojson, file2.geojson]
options: {
  "mergeStrategy": "append",
  "transformToCRS": "EPSG:4326", 
  "validateGeometry": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "import-task-001",
    "estimatedDuration": 5000,
    "filesQueued": 2
  }
}
```

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/export
**GeoJSONエクスポート** 🟡

**Query Parameters:**
- `format`: 'geojson' | 'shapefile' | 'kml' (default: 'geojson')  
- `compressed`: boolean (default: false)
- `includeStyle`: boolean (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/downloads/shapes-tokyo-export.geojson",
    "filename": "shapes-tokyo-export.geojson",
    "size": 156789,
    "expiresAt": 1703209856789
  }
}
```

### 3. バッチ処理エンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/batch
**バッチ処理開始** 🟡

**Request:**
```json
{
  "operation": "download",
  "sources": [
    {
      "id": "source-001",
      "url": "https://example.com/tokyo-districts.geojson",
      "format": "geojson"
    },
    {
      "id": "source-002", 
      "url": "https://example.com/osaka-districts.geojson",
      "format": "geojson",
      "headers": {
        "Authorization": "Bearer token123"
      }
    }
  ],
  "options": {
    "concurrent": 4,
    "timeout": 30000,
    "retryCount": 3,
    "validateGeometry": true,
    "transformToCRS": "EPSG:4326"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "build-task-001",
    "status": "pending",
    "estimatedDuration": 15000,
    "sourcesCount": 2
  }
}
```

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/batch/:taskId
**バッチ処理状況確認** 🟡

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "build-task-001",
    "status": "running",
    "progress": {
      "current": 1,
      "total": 2,
      "percentage": 50,
      "stage": "downloading",
      "message": "Processing source-002...",
      "estimatedTimeRemaining": 7500
    },
    "results": {
      "source-001": {
        "status": "completed",
        "featureCount": 23,
        "dataSize": 15680
      },
      "source-002": {
        "status": "running",
        "progress": 75
      }
    }
  }
}
```

#### DELETE /t/:treeId/:pageNodeId/:targetNodeId/shapes/batch/:taskId
**バッチ処理キャンセル** 🟡

### 4. ベクトルタイル生成エンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/vector-tiles
**ベクトルタイル生成開始** 🔴

**Request:**
```json
{
  "options": {
    "minZoom": 0,
    "maxZoom": 14,
    "tileSize": 512,
    "buffer": 64,
    "tolerance": 1,
    "extent": 4096,
    "layerName": "shapes"
  },
  "cachePolicy": {
    "ttl": 43200,
    "maxSize": 100,
    "compression": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "vectortile-task-001",
    "estimatedTileCount": 256,
    "estimatedDuration": 30000
  }
}
```

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/vector-tiles/:taskId
**ベクトルタイル生成状況** 🔴

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/vector-tiles/:z/:x/:y
**個別タイル取得** 🔴

**Response Headers:**
```
Content-Type: application/x-protobuf
Content-Encoding: gzip
Cache-Control: public, max-age=43200
```

### 5. Working Copy管理エンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/draft
**Working Copy作成** 🟢

**Response:**
```json
{
  "success": true,
  "data": {
    "draftId": "wc-shapes-tokyo-001",
    "copiedAt": 1703123456789,
    "expiresAt": 1703209856789
  }
}
```

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/draft/:draftId
**Working Copy取得** 🟢

#### PUT /t/:treeId/:pageNodeId/:targetNodeId/shapes/draft/:draftId  
**Working Copy更新** 🟢

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/draft/:draftId/commit
**Working Copyコミット** 🟢

**Response:**
```json
{
  "success": true,
  "data": {
    "committedToNodeId": "shapes-tokyo",
    "newVersion": 2,
    "changes": {
      "geojsonFeatures": 5,
      "styleUpdates": 2,
      "layerConfigChanges": 1
    }
  }
}
```

#### DELETE /t/:treeId/:pageNodeId/:targetNodeId/shapes/draft/:draftId
**Working Copy破棄** 🟢

### 6. スタイル管理エンドポイント

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/style
**現在のスタイル取得** 🟡

#### PUT /t/:treeId/:pageNodeId/:targetNodeId/shapes/style
**スタイル更新** 🟡

**Request:**
```json
{
  "defaultStyle": {
    "polygon": {
      "fillColor": "#ff0000",
      "fillOpacity": 0.7,
      "strokeColor": "#990000",
      "strokeWidth": 3
    },
    "label": {
      "field": "name",
      "fontSize": 16,
      "fontColor": "#ffffff"
    }
  },
  "conditionalStyles": [
    {
      "condition": "properties.population > 100000",
      "style": {
        "polygon": {
          "fillColor": "#ff6600"
        }
      }
    }
  ]
}
```

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/style/preview
**スタイルプレビュー生成** 🟡

### 7. BaseMap連携エンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/basemap/:baseMapId/attach
**BaseMapに添付** 🟡

**Request:**
```json
{
  "layerConfig": {
    "zIndex": 10,
    "opacity": 0.8,
    "interactive": true
  },
  "styleOverrides": {
    "polygon": {
      "strokeWidth": 1
    }
  }
}
```

#### DELETE /t/:treeId/:pageNodeId/:targetNodeId/shapes/basemap/:baseMapId/detach  
**BaseMapから分離** 🟡

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/basemap
**関連BaseMap一覧** 🟡

### 8. 座標系変換エンドポイント

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/transform
**座標系変換** 🟡

**Request:**
```json
{
  "fromCRS": "EPSG:3857",
  "toCRS": "EPSG:4326", 
  "options": {
    "validateBounds": true,
    "precision": 6
  }
}
```

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/crs/detect
**座標系自動検出** 🟡

**Response:**
```json
{
  "success": true,
  "data": {
    "detectedCRS": "EPSG:4326",
    "confidence": 0.95,
    "boundingBox": [139.6917, 35.6595, 139.7044, 35.6762],
    "suggestions": [
      {
        "crs": "EPSG:4326",
        "name": "WGS 84",
        "confidence": 0.95
      },
      {
        "crs": "EPSG:3857", 
        "name": "Web Mercator",
        "confidence": 0.12
      }
    ]
  }
}
```

### 9. 統計・分析エンドポイント

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/stats
**統計情報取得** 🟡

**Response:**
```json
{
  "success": true,
  "data": {
    "geometry": {
      "featureCount": 23,
      "totalVertices": 1250,
      "geometryTypes": {
        "Polygon": 20,
        "MultiPolygon": 3
      },
      "area": 627000000,
      "perimeter": 125000
    },
    "data": {
      "dataSize": 15680,
      "compressionRatio": 0.65,
      "lastProcessed": 1703123456789
    },
    "spatial": {
      "boundingBox": [139.6917, 35.6595, 139.7044, 35.6762],
      "centroid": [139.698, 35.6678],
      "crs": "EPSG:4326"
    }
  }
}
```

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/analyze
**空間分析実行** 🔴

**Request:**
```json
{
  "operation": "buffer",
  "parameters": {
    "distance": 1000,
    "units": "meters"
  }
}
```

### 10. キャッシュ管理エンドポイント

#### GET /t/:treeId/:pageNodeId/:targetNodeId/shapes/cache
**キャッシュ状況確認** 🟡

#### DELETE /t/:treeId/:pageNodeId/:targetNodeId/shapes/cache
**キャッシュクリア** 🟡

#### POST /t/:treeId/:pageNodeId/:targetNodeId/shapes/cache/warm
**キャッシュウォームアップ** 🟡

## WebSocket リアルタイム通信 🟡

### 接続エンドポイント
```
wss://api.example.com/t/:treeId/:pageNodeId/:targetNodeId/shapes/ws
```

### メッセージ型

#### 進行状況通知
```json
{
  "type": "progress",
  "taskId": "build-task-001",
  "data": {
    "percentage": 75,
    "stage": "processing",
    "message": "Processing features..."
  }
}
```

#### Working Copy変更通知  
```json
{
  "type": "draftUpdated",
  "draftId": "wc-shapes-tokyo-001",
  "data": {
    "isDirty": true,
    "lastModified": 1703123456789
  }
}
```

#### エラー通知
```json
{
  "type": "error", 
  "taskId": "vectortile-task-001",
  "data": {
    "code": "MEMORY_ERROR",
    "message": "Insufficient memory for tile generation",
    "recoverable": false
  }
}
```

## エラーレスポンス仕様 🟢

### 共通エラー形式
```json
{
  "success": false,
  "error": {
    "code": "SHAPES_NOT_FOUND",
    "message": "The specified shapes entity does not exist",
    "details": {
      "nodeId": "shapes-invalid",
      "treeId": "proj-001"
    }
  },
  "meta": {
    "timestamp": 1703123456789,
    "requestId": "req-001"
  }
}
```

### エラーコード一覧

| コード | 説明 | HTTPステータス |
|--------|------|----------------|
| `SHAPES_NOT_FOUND` | Shapesエンティティが見つからない | 404 |
| `INVALID_GEOJSON` | 不正なGeoJSON形式 | 400 |
| `GEOMETRY_TOO_LARGE` | ジオメトリが大きすぎる | 413 |
| `UNSUPPORTED_CRS` | 非対応の座標系 | 400 |
| `BATCH_PROCESSING_FAILED` | バッチ処理失敗 | 500 |
| `WORKER_TIMEOUT` | WebWorkerタイムアウト | 408 |
| `INSUFFICIENT_MEMORY` | メモリ不足 | 507 |
| `WORKING_COPY_CONFLICT` | Working Copy競合 | 409 |
| `INVALID_TILE_COORDINATES` | 不正なタイル座標 | 400 |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 | 429 |

## 認証・認可 🟢

### 認証方式
- JWT Bearer Token (hierarchidb標準)
- プロジェクト・ノードレベルの権限チェック

### 必要権限
- `READ`: Shapes情報取得、エクスポート
- `WRITE`: Shapes作成・更新、インポート
- `DELETE`: Shapes削除
- `MANAGE`: Working Copy管理、キャッシュ操作

## レート制限 🟡

| エンドポイント | 制限 |
|----------------|------|
| バッチ処理開始 | 10回/分 |
| ベクトルタイル生成 | 5回/分 |  
| ファイルインポート | 20回/分 |
| 通常のCRUD操作 | 100回/分 |

## パフォーマンス最適化 🟡

### キャッシュヘッダー
```http
Cache-Control: public, max-age=3600
ETag: "shapes-tokyo-v2-hash123"
Last-Modified: Wed, 21 Oct 2023 07:28:00 GMT
```

### 条件付きリクエスト
```http
If-None-Match: "shapes-tokyo-v2-hash123"
If-Modified-Since: Wed, 21 Oct 2023 07:28:00 GMT
```

### 圧縮サポート
```http
Accept-Encoding: gzip, deflate, br
Content-Encoding: gzip
```

このAPI設計により、地理空間データの効率的な管理と高性能な処理を実現し、リアルタイムな協調編集環境を提供します。