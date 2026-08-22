/**
 * Default built-in plugins collection
 */

import type { TreeTablePlugin } from '~/plugin/types';
import { inlineEditPlugin } from './InlineEditPlugin.js';
import { keyboardNavigationPlugin } from './KeyboardNavigationPlugin.js';

export const defaultPlugins: TreeTablePlugin[] = [keyboardNavigationPlugin, inlineEditPlugin];

export const minimalPlugins: TreeTablePlugin[] = [keyboardNavigationPlugin];

export const fullFeaturedPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
  // Future:
  // - dragDropPlugin
  // - contextMenuPlugin
  // - virtualScrollPlugin
  // - searchPlugin
  // - filterPlugin
  // - sortPlugin
];
