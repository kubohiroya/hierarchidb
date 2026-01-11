import React, { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { useTranslation } from '../../i18n.js';
import type { ShapeSourceMetadataRow } from '@hierarchidb/plugin-service-api';
import { Typography } from '@mui/material';

type PreviewMetadataRow = ShapeSourceMetadataRow;

const formatLogicalCode = (value: unknown) => {
  const text = String(value ?? '');
  if (text === 'N/A') {
    return React.createElement(Typography, { color: 'error.main' }, 'N/A');
  }
  return text;
};

const formatBBox = (bbox?: [number, number, number, number]) => {
  if (!bbox || bbox.length !== 4) return '';
  const [minX, minY, maxX, maxY] = bbox;
  if ([minX, minY, maxX, maxY].some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return '';
  }
  return `${minX.toFixed(4)}, ${minY.toFixed(4)}, ${maxX.toFixed(4)}, ${maxY.toFixed(4)}`;
};

export const useVectorTilePreviewTable = (
  metadataRows: PreviewMetadataRow[],
  matchedIdSet: Set<string>,
  searchKeyword: string,
) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('originLabel');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const metadataTableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const rows = metadataRows.map((row) => ({
      id: row.originKey,
      rawOriginKey: row.originKey,
      originLabel: row.originLabel ?? '',
      countryCode: row.countryCode ?? '',
      adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
      dataSource: row.dataSource ?? '',
      createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
      fetchVertexCount: normalizeCount(row.fetchVertexCount),
      fetchPolygonCount: normalizeCount(row.fetchPolygonCount),
      transformVertexCount: normalizeCount(row.transformVertexCount),
      transformPolygonCount: normalizeCount(row.transformPolygonCount),
      vtVertexCount: normalizeCount(row.vtVertexCount),
      vtPolygonCount: normalizeCount(row.vtPolygonCount),
      bbox: formatBBox(row.bbox),
      originKey: row.originKey,
    }));
    const keyword = searchKeyword.trim().toLowerCase();
    const filtered = keyword
      ? rows.filter((row) => matchedIdSet.has(row.rawOriginKey))
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
    { id: 'originLabel', label: t('preview.metadata.columns.originLabel', 'Origin'), width: 220, sortable: true },
    { id: 'countryCode', label: t('preview.metadata.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'adminLevel', label: t('preview.metadata.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'dataSource', label: t('preview.metadata.columns.dataSource', 'Data Source'), width: 140, sortable: true },
    { id: 'createdAt', label: t('preview.metadata.columns.createdAt', 'Created At'), width: 180, sortable: true },
    { id: 'fetchVertexCount', label: t('preview.metadata.columns.fetchVertexCount', 'Fetch Vertices'), width: 140, align: 'right', sortable: true },
    { id: 'fetchPolygonCount', label: t('preview.metadata.columns.fetchPolygonCount', 'Fetch Polygons'), width: 140, align: 'right', sortable: true },
    { id: 'transformVertexCount', label: t('preview.metadata.columns.transformVertexCount', 'Transform Vertices'), width: 160, align: 'right', sortable: true },
    { id: 'transformPolygonCount', label: t('preview.metadata.columns.transformPolygonCount', 'Transform Polygons'), width: 160, align: 'right', sortable: true },
    { id: 'vtVertexCount', label: t('preview.metadata.columns.vtVertexCount', 'VT Vertices'), width: 140, align: 'right', sortable: true },
    { id: 'vtPolygonCount', label: t('preview.metadata.columns.vtPolygonCount', 'VT Polygons'), width: 140, align: 'right', sortable: true },
    { id: 'bbox', label: t('preview.metadata.columns.bbox', 'Bounding Box'), width: 220, sortable: true },
    { id: 'originKey', label: t('preview.metadata.columns.originKey', 'Origin Key'), width: 240, sortable: true, format: formatLogicalCode },
  ]), [t]);

  return {
    metadataColumns,
    metadataTableRows,
    sortColumn,
    sortDirection,
    handleSort,
  };
};
