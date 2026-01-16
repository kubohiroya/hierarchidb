import { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useTranslation } from '../../i18n.js';
import type { ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';

type TransformErrorRow = ShapeTransformErrorRecord;

export const useTransformErrorTable = (
  errorRows: TransformErrorRow[],
  matchedIdSet: Set<string>,
  searchKeyword: string,
) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const errorTableRows = useMemo(() => {
    const rows = errorRows.map((row) => ({
      id: row.id,
      rawId: row.id,
      createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
      sourceKey: row.sourceKey ?? '',
      countryCode: row.countryCode ?? '',
      adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
      bandId: row.bandId ?? '',
      featureId: row.featureId ?? '',
      polygonCount: row.polygonCount ?? '',
      ringCount: row.ringCount ?? '',
      message: row.message ?? '',
    }));
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
    { id: 'createdAt', label: t('preview.errors.columns.createdAt', 'Recorded At'), width: 180, sortable: true },
    { id: 'sourceKey', label: t('preview.errors.columns.sourceKey', 'Source Key'), width: 200, sortable: true },
    { id: 'countryCode', label: t('preview.errors.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'adminLevel', label: t('preview.errors.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'bandId', label: t('preview.errors.columns.bandId', 'Band'), width: 80, align: 'right', sortable: true },
    { id: 'featureId', label: t('preview.errors.columns.featureId', 'Feature Id'), width: 160, sortable: true },
    { id: 'polygonCount', label: t('preview.errors.columns.polygonCount', 'Polygons'), width: 120, align: 'right', sortable: true },
    { id: 'ringCount', label: t('preview.errors.columns.ringCount', 'Rings'), width: 120, align: 'right', sortable: true },
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
