import { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useTranslation } from '../../i18n.js';
import type { ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';

type TransformErrorRow = ShapeTransformErrorRecord;

export const useTransformErrorTable = (
  errorRows: TransformErrorRow[],
  matchedIdSet: Set<string>,
  searchKeyword: string,
  featureAdminNameMap: Map<string, { countryName?: string; adminName?: string; adminLevel?: number }>,
) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('featureId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const errorTableRows = useMemo(() => {
    const rows = errorRows.map((row) => {
      const featureId = row.featureId ?? '';
      const adminInfo = featureId ? featureAdminNameMap.get(featureId) : undefined;
      const adminLevel = row.adminLevel ?? adminInfo?.adminLevel ?? null;
      const adminAreaName = adminLevel === 0 ? '' : adminInfo?.adminName ?? '';
      const totalPolygonCount = row.polygonCount ?? 0;
      const errorPolygonCount = row.polygonErrorCount ?? totalPolygonCount;
      const totalRingCount = row.ringCount ?? 0;
      const errorRingCount = row.ringErrorCount ?? totalRingCount;
      return ({
        id: row.id,
        rawId: row.id,
        countryCode: row.countryCode ?? '',
        admin0Name: adminInfo?.countryName ?? '',
        adminAreaName,
        adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
        bandId: row.bandId ?? '',
        featureId: row.featureId ?? '',
        polygonCount: `${errorPolygonCount}/${totalPolygonCount}`,
        ringCount: `${errorRingCount}/${totalRingCount}`,
        message: row.message ?? '',
      });
    });
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedIdSet.has(row.rawId))
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortColumn as keyof typeof a];
      const bv = b[sortColumn as keyof typeof b];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'asc' ? av - bv : bv - av;
      }
      const astr = String(av ?? '');
      const bstr = String(bv ?? '');
      return sortDirection === 'asc' ? astr.localeCompare(bstr) : bstr.localeCompare(astr);
    });
    return sorted;
  }, [errorRows, matchedIdSet, searchKeyword, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const errorColumns = useMemo<GridColumn<(typeof errorTableRows)[number]>[]>(() => ([
    { id: 'countryCode', label: t('preview.errors.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'admin0Name', label: t('preview.errors.columns.admin0Name', 'Admin0 Name'), width: 160, sortable: true },
    { id: 'adminAreaName', label: t('preview.errors.columns.adminAreaName', 'Admin1/2 Name'), width: 180, sortable: true },
    { id: 'adminLevel', label: t('preview.errors.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'bandId', label: t('preview.errors.columns.bandId', 'Band'), width: 80, align: 'right', sortable: true },
    { id: 'featureId', label: t('preview.errors.columns.featureId', 'Feature Id'), width: 160, sortable: true },
    { id: 'polygonCount', label: t('preview.errors.columns.polygonCount', 'Polygons (Error/Total)'), width: 150, align: 'right', sortable: true },
    { id: 'ringCount', label: t('preview.errors.columns.ringCount', 'Rings (Error/Total)'), width: 150, align: 'right', sortable: true },
    { id: 'message', label: t('preview.errors.columns.message', 'Message'), width: 320, sortable: true },
  ]), [t]);

  return {
    errorColumns,
    errorTableRows,
    sortColumn,
    sortDirection,
    handleSort,
  };
};
