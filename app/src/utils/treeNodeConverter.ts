/**
 * TreeNode to TreeNodeData Conversion Utilities
 *
 * Converts core TreeNode objects to UI-friendly TreeNodeData objects
 * for use with TreeConsolePanel.
 */

import type { TreeNode } from '@hierarchidb/feature-core/common-types';
import type { TreeNodeData, TreeTableColumn } from '@hierarchidb/ui-shell/ui-treeconsole-base';

/**
 * Convert TreeNode to TreeNodeData for UI display
 */
export function convertTreeNodeToTreeNodeData(node: TreeNode): TreeNodeData {
  return {
    // Map TreeNode properties to TreeNodeData
    ...node,
    id: node.id, // Ensure id is always a string
    nodeType: node.nodeType,

    // UI-specific properties can be added here
    removedAt: (() => {
      const source =
        (node as { removedAt?: number | string; deletedAt?: number | string }).removedAt ??
        (node as { deletedAt?: number | string }).deletedAt;
      if (source == null) return undefined;
      const numeric = typeof source === 'number' ? source : Number(source);
      return Number.isFinite(numeric) ? numeric : undefined;
    })(),
  };
}

/**
 * Convert array of TreeNodes to TreeNodeData array
 */
export function convertTreeNodesToTreeNodeData(nodes: TreeNode[]): TreeNodeData[] {
  return nodes.map(convertTreeNodeToTreeNodeData);
}

/**
 * Create default columns configuration for TreeTable
 */
type ColumnOptions = {
  t?: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
  locale?: string;
  includeRemovedAt?: boolean;
};

export function createDefaultColumns(options?: ColumnOptions): TreeTableColumn[] {
  const t = options?.t ?? ((key: string, fallback?: string) => fallback ?? key);
  const locale = options?.locale ?? 'en';
  const includeRemovedAt = options?.includeRemovedAt ?? false;

  const formatTimestamp = (value?: string | number | null): string => {
    if (value == null) return '';
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return '';
    const target = new Date(numeric);
    if (Number.isNaN(target.getTime())) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffMs = startOfToday.getTime() - startOfTarget.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor(diffMs / dayMs);

    const timeFormatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale.startsWith('ja') ? false : undefined,
    });
    const time = timeFormatter.format(target);

    if (diffDays === 0) return t('trash.timestamps.today', 'Today {{time}}', { time });
    if (diffDays === 1) return t('trash.timestamps.yesterday', 'Yesterday {{time}}', { time });
    if (diffDays === 2) return t('trash.timestamps.twoDaysAgo', 'Two days ago {{time}}', { time });

    const dateFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: locale.startsWith('ja') ? 'numeric' : 'long',
      day: 'numeric',
    });
    const date = dateFormatter.format(target);
    return t('trash.timestamps.dateTime', '{{date}} {{time}}', { date, time });
  };

  const columns: TreeTableColumn[] = [
    {
      id: 'name',
      label: t('trash.columns.name', 'Name'),
      sortable: true,
      width: 300,
      render: (_value: unknown, node: TreeNodeData) => node.name,
    },
    {
      id: 'description',
      label: t('trash.columns.description', 'Description'),
      sortable: true,
      width: 300,
      render: (_value: unknown, node: TreeNodeData) => node.description || '-',
    },
    {
      id: 'createdAt',
      label: t('trash.columns.createdAt', 'Created'),
      sortable: true,
      width: 180,
      render: (_value: unknown, node: TreeNodeData) =>
        formatTimestamp(node.createdAt as number | string | null),
    },
    {
      id: 'updatedAt',
      label: t('trash.columns.updatedAt', 'Modified'),
      sortable: true,
      width: 180,
      render: (_value: unknown, node: TreeNodeData) =>
        formatTimestamp(node.updatedAt as number | string | null),
    },
  ];

  if (includeRemovedAt) {
    columns.push({
      id: 'removedAt',
      label: t('trash.columns.removedAt', 'Removed'),
      sortable: true,
      width: 200,
      render: (
        _value: unknown,
        node: TreeNodeData & { removedAt?: number | string; deletedAt?: number | string }
      ) => {
        return formatTimestamp(node.removedAt ?? node.deletedAt ?? null);
      },
    });
  }

  return columns;
}

/**
 * Create breadcrumb item from TreeNode
 */
export function createBreadcrumbFromTreeNode(node: TreeNode): {
  id: string;
  name: string;
  nodeType: string;
  isClickable: boolean;
} {
  return {
    id: node.id,
    name: node.name,
    nodeType: node.nodeType,
    isClickable: true,
  };
}

/**
 * Filter TreeNodeData based on search term
 */
export function filterTreeNodeData(
  nodes: TreeNodeData[],
  searchTerm: string,
  caseSensitive = false
): TreeNodeData[] {
  if (!searchTerm.trim()) {
    return nodes;
  }

  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return nodes.filter((node) => {
    const name = caseSensitive ? node.name : node.name.toLowerCase();
    return name.includes(term);
  });
}

/**
 * Sort TreeNodeData based on column and direction
 */
export function sortTreeNodeData(
  nodes: TreeNodeData[],
  sortBy: string,
  sortDirection: 'asc' | 'desc'
): TreeNodeData[] {
  return [...nodes].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'description':
        aValue = a.description || '';
        bValue = b.description || '';
        break;
      case 'createdAt':
        aValue = a.createdAt || 0;
        bValue = b.createdAt || 0;
        break;
      case 'updatedAt':
        aValue = a.updatedAt || 0;
        bValue = b.updatedAt || 0;
        break;
      case 'removedAt': {
        const aRemoved =
          (a as { removedAt?: number | string; deletedAt?: number | string }).removedAt ??
          (a as { deletedAt?: number | string }).deletedAt ??
          0;
        const bRemoved =
          (b as { removedAt?: number | string; deletedAt?: number | string }).removedAt ??
          (b as { deletedAt?: number | string }).deletedAt ??
          0;
        aValue = typeof aRemoved === 'number' ? aRemoved : Number(aRemoved);
        bValue = typeof bRemoved === 'number' ? bRemoved : Number(bRemoved);
        break;
      }
      default:
        aValue = a.name;
        bValue = b.name;
    }

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    // Handle numeric comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Fallback to string comparison
    const aStr = String(aValue ?? '');
    const bStr = String(bValue ?? '');
    const comparison = aStr.localeCompare(bStr);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}
