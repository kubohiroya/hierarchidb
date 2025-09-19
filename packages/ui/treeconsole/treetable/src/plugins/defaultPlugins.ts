/**
  * Default Plugins Collection
  * TreeTable
  */

import { inlineEditPlugin } from './InlineEditPlugin.js';
import { keyboardNavigationPlugin } from './KeyboardNavigationPlugin.js';
import type { TreeTablePlugin } from '../plugin/types.js';

/**
    */
export const defaultPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
];

/**
    */
export const minimalPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
];

/**
    */
export const fullFeaturedPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
  //  :
  // - dragDropPlugin
  // - contextMenuPlugin
  // - virtualScrollPlugin
  // - searchPlugin
  // - filterPlugin
  // - sortPlugin
];