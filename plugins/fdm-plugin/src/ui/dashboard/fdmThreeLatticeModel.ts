import {
  type FdmAxisMap,
  type FdmDashboardCell,
  type FdmDashboardDimensions,
  type FdmFilters,
  filterFdmCells,
} from '@hierarchidb/fdm-api';
import { Vector3 } from 'three';
import { cellAxisValue, getDimensionValues } from './fdmDashboardLayout.js';

export interface FdmLatticePoint {
  readonly cell: FdmDashboardCell;
  readonly position: Vector3;
  readonly isSelected: boolean;
}

export function buildFdmLatticePoints(input: {
  readonly cells: readonly FdmDashboardCell[];
  readonly dimensions: FdmDashboardDimensions;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedCellId?: string;
}): readonly FdmLatticePoint[] {
  const xOuterValues = getDimensionValues(input.dimensions, input.axisMap.xOuter);
  const xInnerValues = getDimensionValues(input.dimensions, input.axisMap.xInner);
  const yValues = getDimensionValues(input.dimensions, input.axisMap.y);
  const zValues = getDimensionValues(input.dimensions, input.axisMap.z);
  const visibleCells = filterFdmCells(input.cells, input.filters);
  return visibleCells.map((cell) => {
    const x =
      indexOfAxisValue(xOuterValues, cellAxisValue(cell, input.axisMap.xOuter)) *
        Math.max(1, xInnerValues.length + 1) +
      indexOfAxisValue(xInnerValues, cellAxisValue(cell, input.axisMap.xInner));
    const y = indexOfAxisValue(yValues, cellAxisValue(cell, input.axisMap.y));
    const z = indexOfAxisValue(zValues, cellAxisValue(cell, input.axisMap.z));
    return {
      cell,
      position: new Vector3(x, y, z),
      isSelected: input.selectedCellId === cell.id,
    };
  });
}

function indexOfAxisValue(values: readonly string[], value: string): number {
  const index = values.indexOf(value);
  if (index < 0) {
    throw new Error(`FDM axis value is missing: ${value}`);
  }
  return index;
}
