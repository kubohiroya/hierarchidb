/**
 * Default built-in plugins collection
 */

import { inlineEditPlugin } from './InlineEditPlugin.js';
import { keyboardNavigationPlugin } from './KeyboardNavigationPlugin.js';
import type { TreeTablePlugin } from '../types.js';

export const defaultPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
  inlineEditPlugin,
];

export const minimalPlugins: TreeTablePlugin[] = [
  keyboardNavigationPlugin,
];

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

