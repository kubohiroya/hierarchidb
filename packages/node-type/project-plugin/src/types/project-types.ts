import type { NodeId, NodeType } from '@hierarchidb/common-type';
import type * as GeoJSON from 'geojson';

//  ==================== ====================

export interface ProjectBasicInfo {
  name: string;
  description: string;
  category: ProjectCategory;
  tags: string[];
  duration: {
    startDate: Date;
    endDate?: Date;
    milestones?: Milestone[];
  };
  organization?: {
    name: string;
    department?: string;
    contactEmail?: string;
  };
  visibility: 'private' | 'team' | 'organization' | 'public';
  collaborators?: Collaborator[];
}

export type ProjectCategory =
  | 'urban-planning'
  | 'disaster-management'
  | 'tourism'
  | 'environment'
  | 'infrastructure'
  | 'research';

export interface Milestone {
  date: Date;
  name: string;
  description: string;
}

export interface Collaborator {
  email: string;
  role: 'viewer' | 'editor' | 'admin';
}

//  ==================== ====================

export interface ProjectRegion {
  coverage: {
    type: 'bbox' | 'polygon' | 'administrative' | 'custom';
    bbox?: BoundingBox;
    polygon?: GeoJSON.Polygon;
    administrative?: AdministrativeArea;
    custom?: CustomArea;
  };
  mapConfig: MapConfiguration;
  coordinateSystem: {
    epsg: number;
    displayFormat: 'decimal' | 'dms' | 'mgrs';
  };
}

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface AdministrativeArea {
  country: string;
  level1?: string;
  level2?: string;
  level3?: string;
}

export interface CustomArea {
  center: [number, number];
  radius: number;
}

export interface MapConfiguration {
  defaultView: {
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  };
  baseMap: 'streets' | 'satellite' | 'terrain' | 'light' | 'dark';
  enable3D?: boolean;
  terrainExaggeration?: number;
}

//  ==================== ====================

export interface DataLayerConfig {
  layers: ProjectLayer[];
  groups?: LayerGroup[];
}

export interface ProjectLayer {
  id: string;
  name: string;
  source: LayerSource;
  config: LayerConfig;
  style: LayerStyle;
  interaction: LayerInteraction;
}

export interface LayerSource {
  nodeId: NodeId;
  nodeType: 'shape' | 'location' | 'route' | 'resolver';
  nodeName: string;
  lastUpdated: Date;
  recordCount: number;
}

export interface LayerConfig {
  enabled: boolean;
  order: number;
  opacity: number;
  minZoom?: number;
  maxZoom?: number;
  filters?: LayerFilter[];
  temporal?: {
    enabled: boolean;
    field: string;
    range?: [Date, Date];
  };
}

export interface LayerFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface LayerStyle {
  type: 'simple' | 'categorized' | 'graduated' | 'rule-based';
  point?: PointStyle;
  line?: LineStyle;
  polygon?: PolygonStyle;
  label?: LabelStyle;
}

export interface PointStyle {
  symbol: 'circle' | 'square' | 'triangle' | 'star' | 'icon';
  size: number | string;
  color: string | ColorRamp;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface LineStyle {
  color: string | ColorRamp;
  width: number | string;
  dashArray?: number[];
  cap?: 'butt' | 'round' | 'square';
  join?: 'bevel' | 'round' | 'miter';
}

export interface PolygonStyle {
  fillColor: string | ColorRamp;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  pattern?: 'solid' | 'dots' | 'lines' | 'cross';
}

export interface LabelStyle {
  field: string;
  font: string;
  size: number;
  color: string;
  haloColor?: string;
  haloWidth?: number;
  placement: 'point' | 'line' | 'polygon';
}

export interface ColorRamp {
  type: 'gradient' | 'discrete';
  field?: string;
  colors: string[];
  breaks?: number[];
}

export interface LayerInteraction {
  hoverable: boolean;
  clickable: boolean;
  selectable: boolean;
  editable: boolean;
  popup?: {
    enabled: boolean;
    template: string;
    fields: string[];
  };
  tooltip?: {
    enabled: boolean;
    field: string;
    format?: string;
  };
}

export interface LayerGroup {
  id: string;
  name: string;
  layers: string[];
  exclusive?: boolean;
}

//  ==================== ====================

export interface SpatialAnalysisConfig {
  analyses: SpatialAnalysis[];
  spatialIndex: {
    type: 'rtree' | 'quadtree' | 'h3' | 's2';
    precision?: number;
    cache: boolean;
  };
}

export interface SpatialAnalysis {
  id: string;
  name: string;
  type: SpatialAnalysisType;
  buffer?: BufferAnalysis;
  intersection?: IntersectionAnalysis;
  nearest?: NearestAnalysis;
  cluster?: ClusterAnalysis;
  density?: DensityAnalysis;
  network?: NetworkAnalysis;
  output: AnalysisOutput;
  execution: AnalysisExecution;
}

export type SpatialAnalysisType =
  | 'buffer'
  | 'intersection'
  | 'union'
  | 'difference'
  | 'nearest'
  | 'cluster'
  | 'density'
  | 'network';

export interface BufferAnalysis {
  sourceLayer: string;
  distance: number;
  unit: 'meters' | 'kilometers' | 'miles';
  dissolve: boolean;
  endCap: 'round' | 'flat' | 'square';
}

export interface IntersectionAnalysis {
  layer1: string;
  layer2: string;
  outputFields: 'all' | 'layer1' | 'layer2' | 'custom';
  spatialRelation: 'intersects' | 'contains' | 'within' | 'overlaps';
}

export interface NearestAnalysis {
  fromLayer: string;
  toLayer: string;
  k: number;
  maxDistance?: number;
  outputLines: boolean;
}

export interface ClusterAnalysis {
  layer: string;
  algorithm: 'k-means' | 'dbscan' | 'hierarchical';
  parameters: {
    k?: number;
    eps?: number;
    minPoints?: number;
  };
}

export interface DensityAnalysis {
  layer: string;
  type: 'kernel' | 'point' | 'line';
  radius: number;
  cellSize: number;
  weightField?: string;
}

export interface NetworkAnalysis {
  networkLayer: string;
  facilityLayer: string;
  analysisType: 'service-area' | 'shortest-path' | 'closest-facility';
  impedance: string;
  cutoff?: number;
  facilities?: number;
}

export interface AnalysisOutput {
  name: string;
  saveAsLayer: boolean;
  style?: LayerStyle;
}

export interface AnalysisExecution {
  auto: boolean;
  schedule?: string;
  dependsOn?: string[];
}

//  ==================== ====================

export interface TemporalAnalysisConfig {
  temporal: {
    enabled: boolean;
    timeRange: {
      start: Date;
      end: Date;
      step: {
        value: number;
        unit: 'hour' | 'day' | 'week' | 'month' | 'year';
      };
    };
    timeFields: TimeFieldMapping[];
    animation: AnimationConfig;
  };
  analyses: TemporalAnalysis[];
  timeline: TimelineConfig;
}

export interface TimeFieldMapping {
  layerId: string;
  field: string;
  format?: string;
  timezone?: string;
}

export interface AnimationConfig {
  enabled: boolean;
  speed: number;
  loop: boolean;
  showTrails: boolean;
  trailLength: number;
}

export interface TemporalAnalysis {
  id: string;
  name: string;
  type: 'trend' | 'hotspot' | 'movement' | 'change-detection';
  trend?: TrendAnalysis;
  hotspot?: HotspotAnalysis;
  movement?: MovementAnalysis;
  changeDetection?: ChangeDetection;
}

export interface TrendAnalysis {
  layer: string;
  valueField: string;
  aggregation: 'sum' | 'mean' | 'max' | 'min' | 'count';
  interval: string;
  trendLine: 'linear' | 'polynomial' | 'exponential';
}

export interface HotspotAnalysis {
  layer: string;
  timeWindow: number;
  spatialWindow: number;
  threshold: number;
}

export interface MovementAnalysis {
  layer: string;
  idField: string;
  showPaths: boolean;
  pathStyle: LineStyle;
  statistics: boolean;
}

export interface ChangeDetection {
  layer: string;
  compareMethod: 'absolute' | 'relative' | 'percentage';
  threshold: number;
  highlightChanges: boolean;
}

export interface TimelineConfig {
  position: 'top' | 'bottom';
  height: number;
  showChart: boolean;
  showEvents: boolean;
  events?: TimelineEvent[];
}

export interface TimelineEvent {
  date: Date;
  label: string;
  color: string;
}

//  ==================== ====================

export interface ProjectOutputConfig {
  report: ReportConfig;
  tiles: TileConfig;
  export: ExportConfig;
  sharing: SharingConfig;
}

export interface ReportConfig {
  enabled: boolean;
  format: 'pdf' | 'html' | 'docx';
  sections: ReportSection[];
  template?: ReportTemplate;
  schedule?: ReportSchedule;
}

export interface ReportSection {
  type: 'title' | 'summary' | 'map' | 'chart' | 'table' | 'text';
  content: any;
  pageBreak?: boolean;
}

export interface ReportTemplate {
  id: string;
  customCSS?: string;
  headerFooter?: boolean;
  tableOfContents?: boolean;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
}

export interface TileConfig {
  enabled: boolean;
  format: 'pmtiles' | 'mbtiles' | 'xyz';
  config: {
    minZoom: number;
    maxZoom: number;
    bounds?: [number, number, number, number];
    layers: string[];
    optimization: {
      simplification: boolean;
      compression: 'none' | 'gzip' | 'brotli';
      tileSize: 256 | 512;
    };
  };
  hosting?: {
    type: 'local' | 'cloud' | 'cdn';
    url?: string;
    credentials?: any;
  };
}

export interface ExportConfig {
  formats: ExportFormat[];
  packaging: 'separate' | 'zip' | 'geopackage';
  api?: {
    enabled: boolean;
    endpoint: string;
    authentication: 'none' | 'apikey' | 'oauth';
    rateLimit?: number;
  };
}

export interface ExportFormat {
  type: 'geojson' | 'shapefile' | 'kml' | 'csv' | 'excel';
  layers: string[];
  includeStyle: boolean;
  includeMetadata: boolean;
}

export interface SharingConfig {
  publicUrl?: boolean;
  embedCode?: boolean;
  qrCode?: boolean;
  permissions: {
    download: boolean;
    print: boolean;
    edit: boolean;
  };
  branding?: {
    logo?: string;
    watermark?: string;
    attribution: string;
  };
}

//  ==================== ====================

export interface ProjectEntity {
  id: NodeId;
  nodeId: NodeId;
  type: string; // Required for GroupEntity

  name: string;
  description: string;
  category: ProjectCategory;
  tags: string[];

  startDate: Date;
  endDate?: Date;
  milestones: Milestone[];

  coverage: ProjectRegion['coverage'];
  mapConfig: MapConfiguration;

  layers: ProjectLayer[];
  layerGroups: LayerGroup[];

  spatialAnalyses: SpatialAnalysis[];
  temporalAnalyses: TemporalAnalysis[];

  outputConfig: ProjectOutputConfig;

  visibility: string;
  permissions: Permission[];
  collaborators: Collaborator[];

  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  version: number;
}

export interface Permission {
  userId: string;
  level: 'read' | 'write' | 'admin';
}

export interface ProjectSnapshot {
  id: NodeId;
  projectEntityId: NodeId;

  name: string;
  description: string;
  timestamp: number;

  mapState: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
    visibleLayers: string[];
  };

  dataState: {
    layers: Array<{
      layerId: string;
      version: number;
      featureCount: number;
    }>;
  };

  analysisState: {
    results: string[];
    parameters: any;
  };

  createdBy: string;
  size: number;
  isBaseline: boolean;
}

export interface AnalysisResult {
  id: NodeId;
  projectEntityId: NodeId;

  analysisId: string;
  analysisType: string;
  name: string;

  inputLayers: string[];
  parameters: Record<string, any>;

  result: {
    type: 'features' | 'raster' | 'statistics' | 'network';
    data: any;
    summary: {
      featureCount?: number;
      statistics?: any;
      metadata?: any;
    };
  };

  executedAt: number;
  executionTime: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
  warnings?: string[];

  outputLayerId?: string;
  cached: boolean;
  expiresAt?: number;
}

export interface ProjectTile {
  id: string;
  projectEntityId: NodeId;

  zoom: number;
  x: number;
  y: number;

  tileData: ArrayBuffer;
  format: 'mvt' | 'png' | 'jpeg' | 'webp';
  layers: string[];

  features: number;
  size: number;
  generatedAt: number;
  lastAccessed: number;
  accessCount: number;
}

// ==================== Working Copy ====================

// ProjectWorkingCopy extends the entity with working copy properties
// To satisfy the WorkingCopy constraint, we need TreeNode properties
export interface ProjectWorkingCopy extends Omit<ProjectEntity, 'id'> {
  // TreeNode required properties (from NodeBase)
  id: NodeId;  // Changed from EntityId to NodeId to match TreeNode
  parentId: NodeId;
  nodeType: NodeType;
  nodeId: NodeId;
  name: string;
  depth: number;

  // WorkingCopyProperties
  originalNodeId?: NodeId;
  copiedAt: number;
  hasEntityCopy?: boolean;
  entityWorkingCopyId?: NodeId;
  originalVersion?: number;
  hasGroupEntityCopy?: Record<string, boolean>;

  // Project-specific working copy properties
  isWorkingCopy: boolean;
  originalId: NodeId;
  isDirty: boolean;
}
