/**
 * Types for TreeConsoleSpeedDialToBeRefactored package
 */

import type { ReactNode } from 'react';

/**
 * SpeedDial アクション型
 */
export interface SpeedDialActionType {
  name: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
}

/**
 * TreeConsoleActions/SpeedDial の Props
 */
export interface TreeConsoleActionsProps {
  /**
   * Page context flags
   */
  isProjectsPage?: boolean;
  isResourcesPage?: boolean;
  isTrashPage?: boolean;

  /**
   * SpeedDial actions to display
   */
  speedDialActions?: SpeedDialActionType[];

  /**
   * Custom SpeedDial icon
   */
  speedDialIcon?: ReactNode;

  /**
   * Color variant based on page type
   */
  color?: 'primary' | 'secondary' | 'inherit';

  /**
   * Position of the SpeedDial
   */
  position?: {
    bottom?: number | string;
    right?: number | string;
    top?: number | string;
    left?: number | string;
  };

  /**
   * Z-index for layering
   */
  zIndex?: number;

  /**
   * Direction of SpeedDial expansion
   */
  direction?: 'up' | 'down' | 'left' | 'right';

  /**
   * Whether SpeedDial is hidden
   */
  hidden?: boolean;

  /**
   * Additional SpeedDial action button (e.g., back button)
   */
  backActionButton?: ReactNode;

  /**
   * Close handler for SpeedDial
   */
  onClose?: () => void;
}

/**
 * Basic SpeedDial menu props
 */
export interface SpeedDialMenuProps {
  /**
   * Actions to display
   */
  actions: SpeedDialActionType[];

  /**
   * Icon for the main button
   */
  icon?: ReactNode;

  /**
   * Tooltip title
   */
  tooltipTitle?: string;

  /**
   * Color variant
   */
  color?: 'primary' | 'secondary' | 'inherit';

  /**
   * Position styles
   */
  position?: {
    bottom?: number | string;
    right?: number | string;
    top?: number | string;
    left?: number | string;
  };

  /**
   * Direction of expansion
   */
  direction?: 'up' | 'down' | 'left' | 'right';

  /**
   * Z-index
   */
  zIndex?: number;

  /**
   * Hidden state
   */
  hidden?: boolean;
}
