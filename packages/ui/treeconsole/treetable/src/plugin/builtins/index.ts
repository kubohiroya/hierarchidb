/**
 * Built-in TreeTable plugins
 *
 * This folder hosts built-in plugin implementations, to avoid confusion between
 * the "plugin system" (`src/plugin/*`) and built-in plugins.
 */

export {
  createInlineEditPlugin,
  inlineEditPlugin,
} from './InlineEditPlugin.js';
export type { InlineEditPluginConfig } from './InlineEditPlugin.js';

export {
  createKeyboardNavigationPlugin,
  keyboardNavigationPlugin,
} from './KeyboardNavigationPlugin.js';
export type { KeyboardNavigationPluginConfig } from './KeyboardNavigationPlugin.js';

export {
  defaultPlugins,
  minimalPlugins,
  fullFeaturedPlugins,
} from './defaultPlugins.js';
