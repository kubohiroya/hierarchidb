export type MapExportManifestFormat = 'json' | 'yaml';

export type MapExportNodeType = 'shape' | 'location' | 'route';

export type MapExportBbox = readonly [number, number, number, number];

export type MapExportViewport = {
  width: number;
  height: number;
};

export type MapExportNodePayload = {
  nodeId?: string;
  nodeType: MapExportNodeType;
  data: Record<string, unknown>;
};

export type MapExportLayerSelection = {
  nodeId: string;
  visible: boolean;
};

export type MapExportJob = {
  id: string;
  output: {
    path: string;
  };
  viewport: MapExportViewport;
  bbox: MapExportBbox;
  nodes: MapExportNodePayload[];
  layers: MapExportLayerSelection[];
};

export type MapExportManifest = {
  version: 1;
  jobs: MapExportJob[];
};

export type ParseMapExportManifestOptions = {
  format: MapExportManifestFormat;
};
