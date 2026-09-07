import {
  type FdmAxisDimension,
  type FdmAxisMap,
  type FdmDashboardCell,
  type FdmDashboardDimensions,
  type FdmFilters,
  filterFdmCells,
  projectFdmCellAxisKey,
} from '@hierarchidb/fdm-api';
import type { FdmMatrixColumn, FdmMatrixRow } from './fdmDashboardViewTypes.js';

export function getDimensionValues(
  dimensions: FdmDashboardDimensions,
  axis: FdmAxisDimension
): readonly string[] {
  return dimensionEntries(dimensions, axis).map((value) => value.id);
}

export function getDimensionLabel(
  dimensions: FdmDashboardDimensions,
  axis: FdmAxisDimension,
  id: string
): string {
  const value = dimensionEntries(dimensions, axis).find((entry) => entry.id === id);
  if (!value) {
    throw new Error(`FDM dimension value is missing: ${axis}:${id}`);
  }
  return value.label;
}

function dimensionEntries(dimensions: FdmDashboardDimensions, axis: FdmAxisDimension) {
  if (axis === 'parameterSet') return dimensions.parameterSets;
  if (axis === 'profile') return dimensions.profiles ?? dimensions.parameterSets;
  if (axis === 'dataset') return dimensions.datasets;
  if (axis === 'timeline') return dimensions.timelines;
  if (axis === 'checkpoint') return dimensions.checkpoints ?? dimensions.timelines;
  return dimensions.computes;
}

export function buildFdmMatrixRows(
  cells: readonly FdmDashboardCell[],
  dimensions: FdmDashboardDimensions,
  filters: FdmFilters,
  axisMap: FdmAxisMap
): readonly FdmMatrixRow[] {
  const visibleCells = filterFdmCells(cells, filters);
  const rows = getDimensionValues(dimensions, axisMap.y);
  const columns = getDimensionValues(dimensions, axisMap.xInner);
  return rows.map((rowKey) => ({
    rowKey,
    rowLabel: getDimensionLabel(dimensions, axisMap.y, rowKey),
    columns: columns.map((columnKey): FdmMatrixColumn => {
      const cell = visibleCells.find(
        (entry) =>
          cellAxisValue(entry, axisMap.y) === rowKey &&
          cellAxisValue(entry, axisMap.xInner) === columnKey
      );
      return {
        columnKey,
        columnLabel: getDimensionLabel(dimensions, axisMap.xInner, columnKey),
        ...(cell === undefined ? {} : { cell }),
      };
    }),
  }));
}

export function cellAxisValue(cell: FdmDashboardCell, axis: FdmAxisDimension): string {
  return projectFdmCellAxisKey(cell, axis);
}
