import React, { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@hierarchidb/ui-grid';
import { Chip, Typography } from '@mui/material';
import { useTranslation } from '../../i18n.js';
import type { ShapeFeatureMetadata, ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';

type PreviewFeatureRow = ShapeFeatureMetadata;

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

const formatArea = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toLocaleString();
};

export const useVectorTileFeatureTable = (
  metadataRows: PreviewFeatureRow[],
  matchedIdSet: Set<string>,
  searchKeyword: string,
  errorRows: ShapeTransformErrorRecord[],
) => {
  const { t } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('featureId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const metadataTableRows = useMemo(() => {
    const normalizeCount = (value?: number) => (typeof value === 'number' ? value : '');
    const errorByFeatureId = new Map<string, { count: number; messages: string[] }>();
    errorRows.forEach((row) => {
      if (!row.featureId) return;
      const entry = errorByFeatureId.get(row.featureId) ?? { count: 0, messages: [] };
      entry.count += 1;
      if (row.message) {
        entry.messages.push(row.message);
      }
      errorByFeatureId.set(row.featureId, entry);
    });
    const rows = metadataRows.map((row) => {
      const errorCount = errorByFeatureId.get(row.featureId ?? '')?.count ?? 0;
      return {
        id: row.featureId ?? row.id,
        rawId: row.id,
        featureId: row.featureId ?? '',
        countryName: row.countryName ?? '',
        countryCode: row.countryCode ?? '',
        adminName: row.adminName ?? '',
        adminLevel: row.adminLevel != null ? `ADM${row.adminLevel}` : '',
        adminCode: row.adminCode ?? '',
        dataSource: row.dataSource ?? '',
        createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : '',
        vertexCount: normalizeCount(row.vertexCount),
        polygonCount: normalizeCount(row.polygonCount),
        bbox: formatBBox(row.bbox),
        area: formatArea(row.area),
        status: errorCount > 0 ? 'failed' : 'completed',
        errorCount,
        errorMessage: (errorByFeatureId.get(row.featureId ?? '')?.messages ?? []).slice(0, 2).join(' / '),
      };
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
  }, [errorRows, matchedIdSet, metadataRows, searchKeyword, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  const metadataColumns = useMemo<GridColumn<(typeof metadataTableRows)[number]>[]>(() => ([
    {
      id: 'status',
      label: t('preview.metadata.columns.status', 'Status'),
      width: 140,
      sortable: true,
      format: (_value, row) => {
        const hasErrors = row.errorCount > 0;
        return (
          <Chip
            size="small"
            color={hasErrors ? 'error' : 'success'}
            label={t(hasErrors ? 'build.taskStatus.failed' : 'build.taskStatus.completed', hasErrors ? 'Failed' : 'Completed')}
          />
        );
      },
    },
    { id: 'featureId', label: t('preview.metadata.columns.featureId', 'Feature ID'), width: 220, sortable: true },
    { id: 'countryName', label: t('preview.metadata.columns.countryName', 'Country'), width: 180, sortable: true },
    { id: 'countryCode', label: t('preview.metadata.columns.countryCode', 'Country Code'), width: 120, sortable: true },
    { id: 'adminName', label: t('preview.metadata.columns.adminName', 'Admin Name'), width: 180, sortable: true },
    { id: 'adminLevel', label: t('preview.metadata.columns.adminLevel', 'Admin Level'), width: 120, align: 'right', sortable: true },
    { id: 'adminCode', label: t('preview.metadata.columns.adminCode', 'Admin Code'), width: 120, sortable: true },
    { id: 'dataSource', label: t('preview.metadata.columns.dataSource', 'Data Source'), width: 140, sortable: true },
    { id: 'createdAt', label: t('preview.metadata.columns.createdAt', 'Created At'), width: 180, sortable: true },
    { id: 'vertexCount', label: t('preview.metadata.columns.vertexCount', 'Vertices'), width: 120, align: 'right', sortable: true },
    { id: 'polygonCount', label: t('preview.metadata.columns.polygonCount', 'Polygons'), width: 120, align: 'right', sortable: true },
    { id: 'errorCount', label: t('preview.metadata.columns.errorCount', 'Errors'), width: 120, align: 'right', sortable: true },
    { id: 'errorMessage', label: t('preview.metadata.columns.errorMessage', 'Error Message'), width: 240, sortable: true },
    { id: 'bbox', label: t('preview.metadata.columns.bbox', 'Bounding Box'), width: 220, sortable: true },
    { id: 'area', label: t('preview.metadata.columns.area', 'Area'), width: 140, align: 'right', sortable: true, format: formatLogicalCode },
  ]), [t]);

  return {
    metadataColumns,
    metadataTableRows,
    sortColumn,
    sortDirection,
    handleSort,
  };
};
