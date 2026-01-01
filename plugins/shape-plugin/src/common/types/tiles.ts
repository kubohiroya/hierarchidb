export type ZoomRange = { zMin: number; zMax: number };

export interface SourceRow {
  id: string;          // 例: "JPN" や "FRA" 等
  filePath: string;    // DLしたGeoJSONのローカルパス
  // bboxを持っておくと以後の最適化に効く
  minLon: number; minLat: number; maxLon: number; maxLat: number;
}

export interface TileIndexRow {
  z: number;
  tileId: number;      // pack(x,y,z)
  sourceId: string;    // SourceRow.id
}

export interface MetaRow {
  key: "zoomRange";
  value: ZoomRange;
}