# Map Export Manifest Format

## 目的

本書は、地図画像生成 runner が受け付ける manifest の初期形式を定義する。JSON と YAML は同じ構造を表す構文差だけであり、parse 後の意味は完全に一致する。

## 正規構造

```typescript
type MapExportManifest = {
  version: 1;
  jobs: MapExportJob[];
};

type MapExportJob = {
  id: string;
  output: {
    path: string;
  };
  viewport: {
    width: number;
    height: number;
  };
  bbox: [west: number, south: number, east: number, north: number];
  nodes: Array<{
    nodeId?: string;
    nodeType: 'shape' | 'location' | 'route';
    data: Record<string, unknown>;
  }>;
  layers?: Array<{
    nodeId: string;
    visible?: boolean;
  }>;
};
```

## 入力境界

- `nodes[*].data` は committed `TreeNode.data` payload として扱う。
- manifest schema に `draftData` は存在しない。`draftData` が現れた場合は validation error とする。
- `data` の plugin 固有詳細は shape/location/route 各 plugin の canonical build API が検証する。
- manifest parser は必須値欠落、不正bbox、不正size、不正nodeType、不正output pathを typed validation error として fail-fast する。
- 欠落値を plugin default、UI default、Working Copy、過去sessionから補完してはならない。

## JSON Example

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "tokyo-routes",
      "output": {
        "path": "exports/tokyo-routes.png"
      },
      "viewport": {
        "width": 1280,
        "height": 720
      },
      "bbox": [139.5, 35.5, 140, 36],
      "nodes": [
        {
          "nodeId": "route-node",
          "nodeType": "route",
          "data": {
            "buildConfig": {
              "routeGeneration": {
                "method": "direct"
              }
            }
          }
        }
      ],
      "layers": [
        {
          "nodeId": "route-node",
          "visible": true
        }
      ]
    }
  ]
}
```

## YAML Example

```yaml
version: 1
jobs:
  - id: tokyo-routes
    output:
      path: exports/tokyo-routes.png
    viewport:
      width: 1280
      height: 720
    bbox: [139.5, 35.5, 140, 36]
    nodes:
      - nodeId: route-node
        nodeType: route
        data:
          buildConfig:
            routeGeneration:
              method: direct
    layers:
      - nodeId: route-node
        visible: true
```

The JSON and YAML examples above normalize to the same `MapExportManifest` value.
