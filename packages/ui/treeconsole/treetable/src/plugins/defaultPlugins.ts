/**
  * Default Plugins Collection
  * TreeTable
  */

import { inlineEditPlugin } from './InlineEditPlugin';
import { keyboardNavigationPlugin } from './KeyboardNavigationPlugin';
import type { TreeTablePlugin } from '../plugin/types';

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