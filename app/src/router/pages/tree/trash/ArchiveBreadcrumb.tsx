import type { TreeConsoleBreadcrumbProps } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { ReactElement } from 'react';

export interface ArchiveBreadcrumbProps extends TreeConsoleBreadcrumbProps {
  trashAction?: 'restore' | 'empty';
}

export function ArchiveBreadcrumb(props: ArchiveBreadcrumbProps): ReactElement {
  return (
    <TreeConsoleBreadcrumb
      {...props}
      useArchiveColumns={true}
      trashAction={props.trashAction ?? 'restore'}
    />
  );
}
