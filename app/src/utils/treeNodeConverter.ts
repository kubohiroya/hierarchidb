/**
 * TreeNode to TreeNodeData Conversion Utilities
 *
 * Converts core TreeNode objects to UI-friendly TreeNodeData objects
 * for use with TreeConsolePanel.
 */

import type { TreeNode } from "@hierarchidb/common-core";
import type { TreeNodeData } from "@hierarchidb/ui-treeconsole-base";
import type { TreeTableColumn } from "@hierarchidb/ui-treeconsole-base";

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
    children: undefined, // Will be populated when expanded
  };
}

/**
 * Convert array of TreeNodes to TreeNodeData array
 */
export function convertTreeNodesToTreeNodeData(
  nodes: TreeNode[],
): TreeNodeData[] {
  return nodes.map(convertTreeNodeToTreeNodeData);
}

/**
 * Create default columns configuration for TreeTable
 */
export function createDefaultColumns(): TreeTableColumn[] {
  return [
    {
      id: "name",
      label: "Name",
      sortable: true,
      width: 300,
      render: (_: unknown, node: TreeNodeData) => node.name,
    },
    {
      id: "description",
      label: "Description",
      sortable: true,
      width: 300,
      render: (_: unknown, node: TreeNodeData) => node.description || "-",
    },
    {
      id: "createdAt",
      label: "Created",
      sortable: true,
      width: 160,
      render: (_: unknown, node: TreeNodeData) => {
        return node.createdAt
          ? new Date(node.createdAt).toLocaleDateString()
          : "";
      },
    },
    {
      id: "updatedAt",
      label: "Modified",
      sortable: true,
      width: 160,
      render: (_: unknown, node: TreeNodeData) => {
        return node.updatedAt
          ? new Date(node.updatedAt).toLocaleDateString()
          : "";
      },
    },
  ];
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
  caseSensitive = false,
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
  sortDirection: "asc" | "desc",
): TreeNodeData[] {
  return [...nodes].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case "name":
        aValue = a.name;
        bValue = b.name;
        break;
      case "description":
        aValue = a.description || "";
        bValue = b.description || "";
        break;
      case "createdAt":
        aValue = a.createdAt || 0;
        bValue = b.createdAt || 0;
        break;
      case "updatedAt":
        aValue = a.updatedAt || 0;
        bValue = b.updatedAt || 0;
        break;
      default:
        aValue = a.name;
        bValue = b.name;
    }

    // Handle string comparison
    if (typeof aValue === "string" && typeof bValue === "string") {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    }

    // Handle numeric comparison
    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    // Fallback to string comparison
    const aStr = String(aValue);
    const bStr = String(bValue);
    const comparison = aStr.localeCompare(bStr);
    return sortDirection === "asc" ? comparison : -comparison;
  });
}
