import type { NodeId, TreeId } from '@hierarchidb/common-type';
import type { WindowState } from '@hierarchidb/ui-floating-window';

export interface SearchResult {
  nodeId: NodeId;
  nodeName: string;
  nodeType: string;
  matchedProperty: string;
  matchedValue: string;
  confidence: number;
  parentPath: string[];
  // StyleMapデータ関連
  styleMapNodeId?: NodeId; // マッチしたStyleMapノードのID
  styleMapNodeName?: string; // StyleMapノード名
  rowIndex?: number; // マッチした行のインデックス（0ベース）
  rowData?: Record<string, any>; // その行の元データ
  displayColumns?: string[]; // 簡易表示用の主要カラム名
}

export interface SearchResultWindowState extends WindowState {
  treeId: TreeId;
  lastSearchKeyword?: string;
  selectedNodeId?: NodeId;
}

export interface SearchResultWindowProps {
  treeId: TreeId;
  results: SearchResult[];
  isLoading?: boolean;
  selectedResults?: Set<NodeId>; // 選択された結果のNodeId集合
  onResultSelect?: (result: SearchResult, isMultiSelect: boolean) => void;
  onResultsMultiSelect?: (results: SearchResult[]) => void; // 複数選択時
  onMapFocus?: (result: SearchResult) => void; // 地図フォーカス
  onClose?: () => void;
  onRefresh?: () => void;
}

export interface SearchResultTableProps {
  results: SearchResult[];
  selectedResults: Set<NodeId>;
  onResultSelect: (result: SearchResult, isMultiSelect: boolean) => void;
  onMapFocus: (result: SearchResult) => void;
}

export interface SearchResultRowProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: (result: SearchResult, event: React.MouseEvent) => void;
  onDoubleClick?: (result: SearchResult) => void;
}

export interface MapHighlightState {
  searchMatched: Set<NodeId>; // 検索マッチした要素（塗りつぶし色強調）
  selected: Set<NodeId>; // 選択された要素（線色・幅強調）
}

export interface MapHighlightStyles {
  searchMatch: {
    fillColor: string;
    fillOpacity: number;
  };
  selection: {
    strokeColor: string;
    strokeWidth: number;
    strokeOpacity: number;
  };
}

export interface SearchResultItemProps {
  result: SearchResult;
  isSelected?: boolean;
  onClick?: (result: SearchResult) => void;
}

export interface WindowPersistenceService {
  saveWindowState(treeId: TreeId, state: SearchResultWindowState): Promise<void>;
  loadWindowState(treeId: TreeId): Promise<SearchResultWindowState | null>;
  deleteWindowState(treeId: TreeId): Promise<void>;
}
