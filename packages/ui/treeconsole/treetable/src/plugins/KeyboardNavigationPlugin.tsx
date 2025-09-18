/**
  * Keyboard Navigation Plugin
  * TreeTable
  */

import type { TreeTablePlugin } from '../plugin/types.js';
import { KeyboardEvent } from 'react';

/**
    */
export interface KeyboardNavigationPluginConfig {
  /**
      * : true
      */
  enableArrowKeyNavigation?: boolean;

  /**
      * Space: true
      */
  enableSpaceKeySelection?: boolean;

  /**
      * Ctrl+A: true
      */
  enableSelectAll?: boolean;

  /**
      * Shift+: true
      */
  enableRangeSelection?: boolean;

  /**
      * /
      */
  enableExpandCollapseKeys?: boolean;
}

/**
    */
export function createKeyboardNavigationPlugin(config?: KeyboardNavigationPluginConfig): TreeTablePlugin {
  const {
    enableArrowKeyNavigation = true,
    enableSpaceKeySelection = true,
    enableSelectAll = true,
    enableRangeSelection = true,
    enableExpandCollapseKeys = true,
  } = config || {};

  return {
    name: 'keyboard-navigation',
    version: '1.0.0',

    hooks: {
      onKeyDown: (event: KeyboardEvent, context) => {
        const { selectedNodes, expandedNodes } = context;

        if (enableArrowKeyNavigation && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();

          console.log(`Navigating ${event.key === 'ArrowUp' ? 'up' : 'down'}`);

          //  Shift
          if (event.shiftKey && enableRangeSelection) {
            console.log('Range selection with arrow key');
          }

          return true;
        }

        //  /
        if (enableExpandCollapseKeys && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          const currentNode = selectedNodes[0];
          if (currentNode) {
            event.preventDefault();

            if (event.key === 'ArrowLeft') {
              if (expandedNodes.includes(currentNode)) {
                console.log(`Collapsing node: ${currentNode}`);
              } else {
                console.log(`Moving to parent node`);
              }
            } else {
              if (!expandedNodes.includes(currentNode)) {
                console.log(`Expanding node: ${currentNode}`);
              } else {
                console.log(`Moving to first child`);
              }
            }

            return true;
          }
        }

        //  Space
        if (enableSpaceKeySelection && event.key === ' ') {
          event.preventDefault();
          const currentNode = selectedNodes[0];
          if (currentNode) {
            console.log(`Toggling selection for node: ${currentNode}`);
          }
          return true;
        }

        //  Ctrl+A/Cmd+A
        if (enableSelectAll && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          console.log('Selecting all nodes');
          return true;
        }

        //  Escape
        if (event.key === 'Escape' && selectedNodes.length > 0) {
          event.preventDefault();
          console.log('Clearing selection');
          return true;
        }

        //  Home/End
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          console.log(`Moving to ${event.key === 'Home' ? 'first' : 'last'} node`);
          return true;
        }

        //  Page Up/Page Down
        if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault();
          console.log(`Page ${event.key === 'PageUp' ? 'up' : 'down'}`);
          return true;
        }

        return false;
      },

      onSelectionChange: (selectedIds) => {
        console.log(`Selection changed: ${selectedIds.length} nodes selected`);

        if (selectedIds.length === 1) {
          // lastSelectedIndex = 0;
        }
      },

      onExpansionChange: (expandedIds) => {
        console.log(`Expansion changed: ${expandedIds.length} nodes expanded`);
      },

      onPluginInit: () => {
        console.log('KeyboardNavigationPlugin initialized');

        // document.addEventListener('keydown', globalKeyHandler);
      },

      onPluginDestroy: () => {
        console.log('KeyboardNavigationPlugin destroyed');

        // document.removeEventListener('keydown', globalKeyHandler);
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