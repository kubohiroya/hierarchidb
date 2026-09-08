import type {
  FdmAxisDimension,
  FdmAxisMap,
  FdmDashboardCell,
  FdmDashboardCellDetail,
  FdmDashboardPort,
  FdmDashboardResponse,
  FdmFilters,
  FdmNodeData,
  FdmRuntimeEvent,
  FdmViewMode,
} from '@hierarchidb/fdm-api';

export interface FdmDashboardViewProps {
  readonly node: FdmNodeData;
  readonly port: FdmDashboardPort;
  readonly disabled?: boolean;
  readonly onNodeDataChange?: (data: FdmNodeData) => void;
}

export interface FdmDashboardControllerState {
  readonly response?: FdmDashboardResponse;
  readonly cellDetail?: FdmDashboardCellDetail;
  readonly cellLogLines: readonly string[];
  readonly runtimeEvents: readonly FdmRuntimeEvent[];
  readonly selectedCellId?: string;
  readonly selectedViewMode: FdmViewMode;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly loading: boolean;
  readonly error?: string;
}

export interface FdmDashboardControllerActions {
  readonly refresh: () => void;
  readonly reconnect: () => void;
  readonly runSelected: () => void;
  readonly openSelectedResult: () => void;
  readonly selectCell: (cellId: string) => void;
  readonly setViewMode: (viewMode: FdmViewMode) => void;
  readonly setFilter: (dimension: keyof FdmFilters, values: readonly string[]) => void;
  readonly setAxis: (slot: keyof FdmAxisMap, dimension: FdmAxisDimension) => void;
}

export interface FdmMatrixRow {
  readonly rowKey: string;
  readonly rowLabel: string;
  readonly columns: readonly FdmMatrixColumn[];
}

export interface FdmMatrixColumn {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly cell?: FdmDashboardCell;
}
