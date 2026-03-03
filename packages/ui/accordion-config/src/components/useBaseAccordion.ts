import { useCallback, useState } from 'react';
import type React from 'react';

export interface UseBaseAccordionParams {
  defaultExpanded: boolean;
  onExpansionChange?: (expanded: boolean) => void;
}

export interface UseBaseAccordionResult {
  expanded: boolean;
  handleChange: (_event: React.SyntheticEvent, isExpanded: boolean) => void;
}

export function useBaseAccordion({
  defaultExpanded,
  onExpansionChange,
}: UseBaseAccordionParams): UseBaseAccordionResult {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleChange = useCallback((_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded);
    onExpansionChange?.(isExpanded);
  }, [onExpansionChange]);

  return {
    expanded,
    handleChange,
  };
}
