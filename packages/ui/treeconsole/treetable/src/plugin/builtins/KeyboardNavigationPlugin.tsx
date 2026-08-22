/**
 * Keyboard Navigation Plugin (built-in)
 */

import type { KeyboardEvent } from 'react';
import type { TreeTablePlugin } from '~/plugin/types';

export interface KeyboardNavigationPluginConfig {
  /** Enable ArrowUp/ArrowDown navigation (default: true) */
  enableArrowKeyNavigation?: boolean;

  /** Enable Space key selection toggle (default: true) */
  enableSpaceKeySelection?: boolean;

  /** Enable Ctrl/Cmd + A select all (default: true) */
  enableSelectAll?: boolean;

  /** Enable range selection with Shift (default: true) */
  enableRangeSelection?: boolean;

  /** Enable expand/collapse keys via ArrowLeft/ArrowRight (default: true) */
  enableExpandCollapseKeys?: boolean;
}

export function createKeyboardNavigationPlugin(
  config?: KeyboardNavigationPluginConfig
): TreeTablePlugin {
  const {
    enableArrowKeyNavigation = true,
    enableSpaceKeySelection = true,
    enableSelectAll = true,
    enableRangeSelection = true,
    enableExpandCollapseKeys = true,
  } = config ?? {};

  return {
    name: 'keyboard-navigation',
    version: '1.0.0',

    hooks: {
      onKeyDown: (event: KeyboardEvent, context) => {
        const { selectedNodes, expandedNodes } = context;

        if (enableArrowKeyNavigation && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();

          console.log(`Navigating ${event.key === 'ArrowUp' ? 'up' : 'down'}`);

          // Shift
          if (event.shiftKey && enableRangeSelection) {
            console.log('Range selection with arrow key');
          }

          return true;
        }

        // Expand/collapse
        if (enableExpandCollapseKeys && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          const currentNode = selectedNodes[0];
          if (currentNode) {
            event.preventDefault();

            if (event.key === 'ArrowLeft') {
              if (expandedNodes.includes(currentNode)) {
                console.log(`Collapsing node: ${currentNode}`);
              } else {
                console.log('Moving to parent node');
              }
            } else {
              if (!expandedNodes.includes(currentNode)) {
                console.log(`Expanding node: ${currentNode}`);
              } else {
                console.log('Moving to first child');
              }
            }

            return true;
          }
        }

        // Space
        if (enableSpaceKeySelection && event.key === ' ') {
          event.preventDefault();
          const currentNode = selectedNodes[0];
          if (currentNode) {
            console.log(`Toggling selection for node: ${currentNode}`);
          }
          return true;
        }

        // Ctrl+A / Cmd+A
        if (enableSelectAll && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          console.log('Selecting all nodes');
          return true;
        }

        // Escape
        if (event.key === 'Escape' && selectedNodes.length > 0) {
          event.preventDefault();
          console.log('Clearing selection');
          return true;
        }

        // Home/End
        if (event.key === 'home' || event.key === 'End') {
          event.preventDefault();
          console.log(`Moving to ${event.key === 'home' ? 'first' : 'last'} node`);
          return true;
        }

        // Page Up/Page Down
        if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault();
          console.log(`Page ${event.key === 'PageUp' ? 'up' : 'down'}`);
          return true;
        }

        return false;
      },

      onSelectionChange: (selectedIds) => {
        console.log(`Selection changed: ${selectedIds.length} nodes selected`);
      },

      onExpansionChange: (expandedIds) => {
        console.log(`Expansion changed: ${expandedIds.length} nodes expanded`);
      },

      onPluginInit: () => {
        console.log('KeyboardNavigationPlugin initialized');
      },

      onPluginDestroy: () => {
        console.log('KeyboardNavigationPlugin destroyed');
      },
    },

    config: {
      enableArrowKeyNavigation,
      enableSpaceKeySelection,
      enableSelectAll,
      enableRangeSelection,
      enableExpandCollapseKeys,
    },
  };
}

export const keyboardNavigationPlugin = createKeyboardNavigationPlugin();
