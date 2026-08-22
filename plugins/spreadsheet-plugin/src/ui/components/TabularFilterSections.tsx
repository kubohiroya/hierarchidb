import type { TabularDataFilterProps } from '@hierarchidb/ui-tabular';
import React from 'react';
import { TabularKeyValuePanels } from './TabularKeyValuePanels.js';

export interface TabularFilterSectionsProps {
  sections: Parameters<NonNullable<TabularDataFilterProps['renderSections']>>[0];
  translationNamespace?: string;
  columns: string[];
  selectedKeyColumn: string;
  selectedValueColumn: string;
  onKeyColumnChange: (column: string) => void;
  onValueColumnChange: (column: string) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
  menuContainer?: Element | null;
  showPreview?: boolean;
}

export const TabularFilterSections: React.FC<TabularFilterSectionsProps> = ({
  sections,
  translationNamespace,
  columns,
  selectedKeyColumn,
  selectedValueColumn,
  onKeyColumnChange,
  onValueColumnChange,
  dialogRef,
  menuContainer,
  showPreview = true,
}) => {
  const effectiveDialogRef =
    dialogRef ??
    (menuContainer
      ? ({ current: menuContainer as HTMLElement } as React.RefObject<HTMLElement>)
      : undefined);

  return (
    <TabularKeyValuePanels
      dialogRef={effectiveDialogRef}
      translationNamespace={translationNamespace}
      columns={columns}
      selectedKeyColumn={selectedKeyColumn}
      selectedValueColumn={selectedValueColumn}
      onKeyColumnChange={onKeyColumnChange}
      onValueColumnChange={onValueColumnChange}
      filterRulesSlot={sections.filterRules}
      previewSlot={sections.preview}
      errorSlot={sections.error}
      previewDirty={sections.previewDirty}
      showPreview={showPreview}
    />
  );
};
