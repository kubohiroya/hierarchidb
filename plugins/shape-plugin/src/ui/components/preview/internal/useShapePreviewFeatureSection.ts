import { useCallback, useMemo } from 'react';
import { buildErrorSummaryById, type MapPreviewErrorSummaryById } from '@hierarchidb/ui-map';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type {
  ShapeFeatureMetadata,
  ShapeGeometryErrorRecord,
} from '@hierarchidb/shape-api';
import type { ShapePreviewFeatureRow } from '@hierarchidb/ui-map';
import {
  buildCountryGroupKey,
  normalizeText,
  resolveAdminCodeFromMetadata,
  resolveAdminNameFromMetadata,
  isRepairIssueKind,
} from './useShapePreviewStepUtils';

type ResolveSourceContext = (input: {
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  sourceKey?: string;
  dataSource?: string;
}) => {
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  dataSource?: string;
  sourceKey?: string;
};

export type ShapePreviewFeatureSectionResult = {
  toFeatureListRow: (row: ShapeFeatureMetadata) => ShapePreviewFeatureRow;
  featureListRows: ShapePreviewFeatureRow[];
  rowIdToMembers: Map<string, string[]>;
  featureToCountryKey: Map<string, string>;
  countryGroupMembers: Map<string, string[]>;
  baseErrorSummaryById: MapPreviewErrorSummaryById;
  errorSummaryById: MapPreviewErrorSummaryById;
  toggleRecyclingForSelection: (selectedFeatureIds: string[]) => Promise<void>;
};

type ShapePreviewFeatureSectionParams = {
  featureMetadataRows: ShapeFeatureMetadata[];
  normalizedTransformErrorRows: ShapeGeometryErrorRecord[];
  resolveSourceContext: ResolveSourceContext;
  setFeatureMetadataOverride: (value: ShapeFeatureMetadata[] | null) => void;
};

export const useShapePreviewFeatureSection = ({
  featureMetadataRows,
  normalizedTransformErrorRows,
  resolveSourceContext,
  setFeatureMetadataOverride,
}: ShapePreviewFeatureSectionParams): ShapePreviewFeatureSectionResult => {
  const toFeatureListRow = useCallback((row: ShapeFeatureMetadata): ShapePreviewFeatureRow => {
    const context = resolveSourceContext({
      countryCode: row.countryCode,
      countryName: row.countryName,
      adminLevel: row.adminLevel,
      dataSource: row.dataSource,
    });
    const adminLevel = context.adminLevel ?? row.adminLevel;
    const adminName = resolveAdminNameFromMetadata(row, adminLevel, context);
    const adminCode = resolveAdminCodeFromMetadata(row, adminLevel, context);
    return {
      id: row.id,
      featureId: row.featureId,
      countryName: context.countryName ?? row.countryName,
      countryCode: context.countryCode ?? row.countryCode,
      adminName,
      adminLevel,
      adminCode,
      dataSource: context.dataSource ?? row.dataSource,
      createdAt: row.createdAt,
      vertexCount: row.vertexCount,
      polygonCount: row.polygonCount,
      bbox: row.bbox,
      area: row.area,
      recycling: row.recycling ?? false,
    };
  }, [resolveSourceContext]);

  const {
    featureListRows,
    rowIdToMembers,
    featureToCountryKey,
    countryGroupMembers,
  } = useMemo(() => {
    const rows = featureMetadataRows.map((row) => toFeatureListRow(row));
    const collapsed = new Map<string, ShapePreviewFeatureRow>();

    const pickPreferredRow = (current: ShapePreviewFeatureRow, next: ShapePreviewFeatureRow) => {
      const currentVertices = current.vertexCount ?? 0;
      const nextVertices = next.vertexCount ?? 0;
      const currentPolygons = current.polygonCount ?? 0;
      const nextPolygons = next.polygonCount ?? 0;
      if (nextVertices + nextPolygons > currentVertices + currentPolygons) {
        return next;
      }
      if (!current.dataSource && next.dataSource) return next;
      if (!current.adminName && next.adminName) return next;
      if (!current.adminCode && next.adminCode) return next;
      return current;
    };

    rows.forEach((row) => {
      const key = row.featureId ?? row.id;
      if (!key) return;
      const existingRow = collapsed.get(key);
      collapsed.set(key, existingRow ? pickPreferredRow(existingRow, row) : row);
    });

    const existing = new Set(collapsed.keys());
    normalizedTransformErrorRows.forEach((errorRow) => {
      const featureId = errorRow.featureId;
      if (!featureId) return;
      if (existing.has(featureId)) return;
      const context = resolveSourceContext({
        countryCode: errorRow.countryCode,
        countryName: errorRow.countryName,
        adminLevel: errorRow.adminLevel,
        sourceKey: errorRow.sourceKey,
      });
      const adminLevel = context.adminLevel ?? errorRow.adminLevel;
      const adminName = adminLevel === 0 ? context.countryName : undefined;
      const adminCode = adminLevel === 0 ? context.countryCode : undefined;
      collapsed.set(featureId, {
        id: featureId,
        featureId,
        countryName: context.countryName ?? errorRow.countryName,
        countryCode: context.countryCode ?? errorRow.countryCode,
        adminName,
        adminLevel,
        adminCode,
        dataSource: context.dataSource,
        createdAt: errorRow.createdAt,
      });
      existing.add(featureId);
    });

    const listRows: ShapePreviewFeatureRow[] = [];
    const rowIdToMembers = new Map<string, string[]>();
    const featureToCountryKey = new Map<string, string>();
    const countryGroupMembers = new Map<string, string[]>();
    const baseRows = Array.from(collapsed.values());

    baseRows.forEach((row) => {
      const memberId = String(row.featureId ?? row.id ?? '');
      if (!memberId) return;
      const rowKey = String(row.featureId ?? row.id ?? '');
      const countryKey = buildCountryGroupKey(row.countryCode);
      if (countryKey) {
        featureToCountryKey.set(memberId, countryKey);
        const members = countryGroupMembers.get(countryKey) ?? [];
        members.push(memberId);
        countryGroupMembers.set(countryKey, members);
      }
      listRows.push({ ...row, aggregationLevel: 'feature' });
      rowIdToMembers.set(rowKey, [memberId]);
    });

    return {
      featureListRows: [...listRows],
      rowIdToMembers,
      featureToCountryKey,
      countryGroupMembers,
    };
  }, [featureMetadataRows, normalizedTransformErrorRows, resolveSourceContext, toFeatureListRow]);

  const baseErrorSummaryById = useMemo(() => {
    const summary = new Map<string, { errorCount: number; repairCount: number; count: number; messages: string[] }>();
    featureListRows.forEach((row) => {
      const id = row.featureId ?? row.id;
      if (!id) return;
      const key = String(id);
      const metadataErrorCount = typeof (row as { errorCount?: number }).errorCount === 'number'
        ? Math.max(0, (row as { errorCount?: number }).errorCount ?? 0)
        : 0;
      const metadataRepairCount = typeof (row as { repairCount?: number }).repairCount === 'number'
        ? Math.max(0, (row as { repairCount?: number }).repairCount ?? 0)
        : 0;
      if (metadataErrorCount === 0 && metadataRepairCount === 0) return;
      summary.set(key, {
        errorCount: metadataErrorCount,
        repairCount: metadataRepairCount,
        count: metadataErrorCount,
        messages: [],
      });
    });

    const transformErrorSummary = buildErrorSummaryById(normalizedTransformErrorRows, {
      getId: (row) => row.featureId ?? undefined,
      getMessage: (row) => normalizeText(row.message),
      getKind: (row) => (isRepairIssueKind(row.issueKind) ? 'repair' : 'error'),
    });

    transformErrorSummary.forEach((transformEntry, key) => {
      const entry = summary.get(key) ?? {
        errorCount: 0,
        repairCount: 0,
        count: 0,
        messages: [],
      };
      entry.errorCount += transformEntry.errorCount ?? 0;
      entry.repairCount += transformEntry.repairCount ?? 0;
      entry.count = entry.errorCount;
      entry.messages.push(...transformEntry.messages);
      summary.set(key, entry);
    });

    return summary;
  }, [featureListRows, normalizedTransformErrorRows]);

  const errorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => {
    if (featureListRows.length === 0) return baseErrorSummaryById;
    const aggregated = new Map(baseErrorSummaryById);
    featureListRows.forEach((row) => {
      const memberFeatureIds = (row as ShapePreviewFeatureRow & { memberFeatureIds?: string[] }).memberFeatureIds;
      if (!memberFeatureIds?.length) return;
      const groupId = String(row.featureId ?? row.id ?? '');
      if (!groupId) return;
      let count = 0;
      let errorCount = 0;
      let repairCount = 0;
      const messages = new Set<string>();
      memberFeatureIds.forEach((memberId) => {
        const summary = baseErrorSummaryById.get(String(memberId));
        if (!summary) return;
        count += summary.count;
        const summaryErrorCount = summary.errorCount ?? 0;
        const summaryRepairCount = summary.repairCount ?? 0;
        errorCount += summaryErrorCount;
        repairCount += summaryRepairCount;
        summary.messages.forEach((message) => messages.add(message));
      });
      if (count > 0) {
        aggregated.set(groupId, {
          count,
          messages: Array.from(messages),
          errorCount,
          repairCount,
        });
      }
    });
    return aggregated;
  }, [baseErrorSummaryById, featureListRows]);

  const toggleRecyclingForSelection = useCallback(async (selectedFeatureIds: string[]) => {
    if (selectedFeatureIds.length === 0) return;

    const expandedIds = new Set<string>();
    selectedFeatureIds.forEach((id) => {
      const members = rowIdToMembers.get(id) ?? [id];
      members.forEach((memberId) => expandedIds.add(memberId));
    });
    if (expandedIds.size === 0) return;

    const selectedRows = featureMetadataRows.filter((row) => {
      const key = String(row.featureId ?? row.id);
      return expandedIds.has(key);
    });
    if (selectedRows.length === 0) return;

    const recyclingCount = selectedRows.filter((row) => row.recycling).length;
    const nextValue = recyclingCount !== selectedRows.length;
    const updatedRows = selectedRows.map((row) => ({ ...row, recycling: nextValue }));

    try {
      await shapeMutationAPIImpl.putFeatureMetadata(updatedRows);
      const updatedRowsMap = new Map(updatedRows.map((row) => [String(row.featureId ?? row.id), row]));
      const nextRows = featureMetadataRows.map((row) => {
        const key = String(row.featureId ?? row.id);
        return updatedRowsMap.get(key) ?? row;
      });
      setFeatureMetadataOverride(nextRows);
    } catch (error) {
      console.warn('[ShapePreviewStep] failed to toggle recycling', error);
    }
  }, [featureMetadataRows, rowIdToMembers, setFeatureMetadataOverride]);

  return {
    toFeatureListRow,
    featureListRows,
    rowIdToMembers,
    featureToCountryKey,
    countryGroupMembers,
    baseErrorSummaryById,
    errorSummaryById,
    toggleRecyclingForSelection,
  };
};
