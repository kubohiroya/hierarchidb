import type { NodeType } from '@hierarchidb/core-types';

type PluginIcon = {
  muiIconName?: string;
  emoji?: string;
  color?: string;
};

export type DisplayPlugin = {
  nodeType: NodeType;
  displayName: string;
  description: string;
  dependencies: string[];
  menuGroup: string;
  createOrder: number;
  icon: PluginIcon;
  iconColor?: string;
  backgroundColor: string;
  hasUI: boolean;
  hasWorker: boolean;
  hasCommon: boolean;
  packageName: string;
  version: string | null;
};
