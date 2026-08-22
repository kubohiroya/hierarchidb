/**
 * Built-in TreeTable plugins
 *
 * This folder hosts built-in plugin implementations, to avoid confusion between
 * the "plugin system" (`src/plugin/*`) and built-in plugins.
 */

export {
  defaultPlugins,
  fullFeaturedPlugins,
  minimalPlugins,
} from './defaultPlugins.js';
export type { InlineEditPluginConfig } from './InlineEditPlugin.js';
export {
  createInlineEditPlugin,
  inlineEditPlugin,
} from './InlineEditPlugin.js';
export type { KeyboardNavigationPluginConfig } from './KeyboardNavigationPlugin.js';
export {
  createKeyboardNavigationPlugin,
  keyboardNavigationPlugin,
} from './KeyboardNavigationPlugin.js';
