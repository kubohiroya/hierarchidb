import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { TreeConsoleBreadcrumbProps } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import type { ReactElement } from 'react';

export interface TrashBreadcrumbProps extends TreeConsoleBreadcrumbProps {
  trashAction?: 'restore' | 'empty';
}

export function TrashBreadcrumb(props: TrashBreadcrumbProps): ReactElement {
  return (
    <TreeConsoleBreadcrumb
      {...props}
      useTrashColumns={true}
      trashAction={props.trashAction ?? 'restore'}
    />
  );
}
