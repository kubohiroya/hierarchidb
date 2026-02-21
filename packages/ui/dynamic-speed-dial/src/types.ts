import type { ReactNode } from 'react';

export type DynamicSpeedDialNode = unknown;

export interface DynamicSpeedDialIconInput {
  muiIconName?: string;
  emoji?: string;
  color?: string;
}

export type DynamicSpeedDialMenuItem = {
  nodeType: string;
  createType?: string;
  label: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
  icon?: DynamicSpeedDialIconInput;
  backgroundColor?: string;
  children?: DynamicSpeedDialMenuItem[];
};

export type DynamicSpeedDialTranslator = (key: string, fallback: string) => string;

export interface DynamicSpeedDialIconResolver {
  (params: {
    nodeType: string;
    icon?: DynamicSpeedDialIconInput;
  }): ReactNode;
}

export interface UseDynamicSpeedDialParams<TNode = DynamicSpeedDialNode> {
  hidden?: boolean;
  menuItems: readonly DynamicSpeedDialMenuItem[];
  onCreateAction: (action: string, node: TNode, options?: { openInNewTab?: boolean }) => void;
  onSuppress?: () => void;
  resolveIcon: DynamicSpeedDialIconResolver;
}

export interface UseDynamicSpeedDialResult {
  open: boolean;
  debugHitbox: boolean;
  hitboxes: {
    container?: DOMRect;
    fab?: DOMRect;
    actions: DOMRect[];
    topAtFab?: string;
  };
  useVM: boolean;
  vmItems: readonly DynamicSpeedDialMenuItem[];
  language: string;
  actionsPointerEvents: 'auto' | 'none';
  dialogOpen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  resolveIcon: DynamicSpeedDialIconResolver;
  handleClose: () => void;
  toggleOpen: () => void;
  handleVMActionClick: (createType: string, options?: { openInNewTab?: boolean }) => void;
  transitionDuration: number;
}
