import React, { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useTranslation } from '../../i18n.js';
import type { ShapeFeatureMetadataRow } from '../../../services/database/ShapeTileMetadataDB.js';
import { Typography } from '@mui/material';

type PreviewMetadataRow = ShapeFeatureMetadataRow & {
  logicalCountryCode?: string;
  logicalAdminCode?: string;
  logicalFeatureId?: string;
};

const formatLogicalCode = (value: unknown) => {
  const text = String(value ?? '');
  if (text === 'N/A') {
    return React.createElement(Typography, { color: 'error.main' }, 'N/A');
  }
  return text;
};

export const useVectorTilePreviewTable = (
  metadataRows: PreviewMetadataRow[],
  matchedIdSet: Set<string>,
  searchKeyword: string,
) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('countryName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const metadataTableRows = useMemo(() => {
    const rows = metadataRows.map((row) => ({
      id: row.featureId,
      rawFeatureId: row.featureId,
      countryName: row.countryName ?? '',
      countryCode: row.logicalCountryCode ?? row.countryCode ?? '',
      adminName: row.adminName ?? '',
      adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
      adminCode: row.logicalAdminCode ?? row.adminCode ?? '',
      dataSource: row.dataSource ?? '',
      createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
      vertexCount: row.vertexCount,
      polygonCount: row.polygonCount,
      bbox: row.bbox ? row.bbox.map((value) => value.toFixed(4)).join(', ') : '',
      area: Number.isFinite(row.area) ? Math.round(row.area).toLocaleString() : '',
      featureId: row.logicalFeatureId ?? row.featureId,
    }));
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedIdSet.has(row.rawFeatureId))
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
  }, [matchedIdSet, metadataRows, searchKeyword, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const metadataColumns = useMemo<GridColumn<(typeof metadataTableRows)[number]>[]>(() => ([
    { id: 'countryName', label: t('preview.metadata.columns.countryName', 'Country'), width: 160, sortable: true },
    { id: 'countryCode', label: t('preview.metadata.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'adminName', label: t('preview.metadata.columns.adminName', 'Admin Name'), width: 180, sortable: true },
    { id: 'adminLevel', label: t('preview.metadata.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'adminCode', label: t('preview.metadata.columns.adminCode', 'Admin Code'), width: 160, sortable: true, format: formatLogicalCode },
    { id: 'dataSource', label: t('preview.metadata.columns.dataSource', 'Data Source'), width: 140, sortable: true },
    { id: 'createdAt', label: t('preview.metadata.columns.createdAt', 'Created At'), width: 180, sortable: true },
    { id: 'vertexCount', label: t('preview.metadata.columns.vertexCount', 'Vertices'), width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: t('preview.metadata.columns.polygonCount', 'Polygons'), width: 120, align: 'right', sortable: true },
    { id: 'bbox', label: t('preview.metadata.columns.bbox', 'Bounding Box'), width: 220, sortable: true },
    { id: 'area', label: t('preview.metadata.columns.area', 'Area'), width: 140, align: 'right', sortable: true },
    { id: 'featureId', label: t('preview.metadata.columns.featureId', 'Feature ID'), width: 160, sortable: true, format: formatLogicalCode },
  ]), [t]);

  return {
    metadataColumns,
    metadataTableRows,
    sortColumn,
    sortDirection,
    handleSort,
  };
};
