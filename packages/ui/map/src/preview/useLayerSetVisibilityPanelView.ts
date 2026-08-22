import { useMemo } from 'react';
import type { LayerSetDefinition, LayerSetId } from './layerSetDefinitions.js';
import { formatAdminLevelLabel } from './layerSetDefinitions.js';

type LayerSetItemBase = {
  layerSetId: LayerSetId;
  hierarchyLabel?: string;
};

const formatHierarchyLabel = (value?: string | number): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return formatAdminLevelLabel(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'Base';
};

export const useLayerSetVisibilityPanelView = <T extends LayerSetItemBase>({
  layerSets,
  items,
}: {
  layerSets: LayerSetDefinition[];
  items: T[];
}) => {
  const orderedSets = useMemo(
    () => [...layerSets].sort((a, b) => b.priority - a.priority),
    [layerSets]
  );

  const itemsBySet = useMemo(() => {
    const grouped = new Map<LayerSetId, T[]>();
    items.forEach((item) => {
      const next = grouped.get(item.layerSetId) ?? [];
      next.push(item);
      grouped.set(item.layerSetId, next);
    });
    return grouped;
  }, [items]);

  const itemsBySetAndHierarchy = useMemo(() => {
    const grouped = new Map<LayerSetId, Map<string, T[]>>();
    items.forEach((item) => {
      const hierarchyKey = formatHierarchyLabel(item.hierarchyLabel);
      const byHierarchy = grouped.get(item.layerSetId) ?? new Map<string, T[]>();
      const hierarchyItems = byHierarchy.get(hierarchyKey) ?? [];
      hierarchyItems.push(item);
      byHierarchy.set(hierarchyKey, hierarchyItems);
      grouped.set(item.layerSetId, byHierarchy);
    });
    return grouped;
  }, [items]);

  return {
    itemsBySet,
    itemsBySetAndHierarchy,
    orderedSets,
  };
};
