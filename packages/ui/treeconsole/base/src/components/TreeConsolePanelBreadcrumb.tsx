import type { ComponentProps, ReactElement } from 'react';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { PanelBreadcrumbNode } from '../hooks/useTreeConsolePanel.js';

export type TreeConsolePanelBreadcrumbRendererProps = {
  readonly items: readonly PanelBreadcrumbNode[];
  readonly defaultRendererProps: ComponentProps<typeof TreeConsoleBreadcrumb>;
  readonly defaultRenderer: () => ReactElement;
};

export type TreeConsolePanelBreadcrumbProps = {
  readonly items: readonly PanelBreadcrumbNode[];
  readonly defaultRendererProps: ComponentProps<typeof TreeConsoleBreadcrumb>;
  readonly renderer?: (props: TreeConsolePanelBreadcrumbRendererProps) => ReactElement;
};

export const TreeConsolePanelBreadcrumb = ({
  items,
  defaultRendererProps,
  renderer,
}: TreeConsolePanelBreadcrumbProps): ReactElement => {
  const defaultRenderer = () => <TreeConsoleBreadcrumb {...defaultRendererProps} />;

  if (renderer) {
    return renderer({ items, defaultRendererProps, defaultRenderer });
  }

  return defaultRenderer();
};
