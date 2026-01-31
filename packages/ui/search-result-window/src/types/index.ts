import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { WindowState } from '@hierarchidb/ui-floating-window';
import type React from 'react';

export interface SearchResult {
  nodeId: NodeId;
  nodeName: string;
  nodeType: string;
  matchedProperty: string;
  matchedValue: string;
  confidence: number;
  parentPath: string[];
  //  Styler
  stylerNodeId?: NodeId; //  StylerID
  stylerNodeName?: string; //  Styler
  rowIndex?: number; //  0
  rowData?: Record<string, any>;
  displayColumns?: string[];
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
  selectedResults?: Set<NodeId>; //  NodeId
  onResultSelect?: (result: SearchResult, isMultiSelect: boolean) => void;
  onResultsMultiSelect?: (results: SearchResult[]) => void;
  onMapFocus?: (result: SearchResult) => void;
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
  searchMatched: Set<NodeId>;
  selected: Set<NodeId>;
  focused: NodeId | null;
  styles: MapHighlightStyles;
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
