import { useCallback, useState } from 'react';

export interface UseCollapsibleSectionParams {
  defaultCollapsed: boolean;
  collapsible: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export interface UseCollapsibleSectionResult {
  collapsed: boolean;
  showHeader: boolean;
  handleToggle: () => void;
}

export function useCollapsibleSection({
  defaultCollapsed,
  collapsible,
  onCollapseChange,
}: UseCollapsibleSectionParams): UseCollapsibleSectionResult {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback(() => {
    if (!collapsible) return;
    setCollapsed((prev) => {
      const next = !prev;
      onCollapseChange?.(next);
      return next;
    });
  }, [collapsible, onCollapseChange]);

  return {
    collapsed,
    showHeader: collapsible,
    handleToggle,
  };
}
