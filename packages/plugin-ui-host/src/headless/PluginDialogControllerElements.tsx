import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { HeadlessDialogProps } from '@hierarchidb/ui-dialog';
import { PluginDialogContent } from '@hierarchidb/ui-dialog';
import type { ConflictDialogProps } from './components/DialogScaffold.js';
import { ConflictDialog } from './components/DialogScaffold.js';

export const createPluginDialogContentComponent = <T,>(
  ContentWrapper: ComponentType<{ children?: ReactNode }>
): NonNullable<HeadlessDialogProps<T>['ContentComponent']> => {
  const WrappedContent = (): ReactElement => (
    <ContentWrapper>
      <PluginDialogContent />
    </ContentWrapper>
  );
  return WrappedContent;
};

export type PluginDialogConflictDialogProps = ConflictDialogProps;

export const PluginDialogConflictDialog = ({
  open,
  updatedAt,
  foregroundSx,
  resolveConflict,
  formatTimestamp,
  translate,
}: PluginDialogConflictDialogProps): ReactElement => (
  <ConflictDialog
    open={open}
    updatedAt={updatedAt}
    foregroundSx={foregroundSx}
    resolveConflict={resolveConflict}
    formatTimestamp={formatTimestamp}
    translate={translate}
  />
);
