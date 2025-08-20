/**
 * Shapes Plugin Exports
 * Main entry point for the hierarchidb shapes plugin
 */

// Worker layer exports
export * from './types';
export * from './handlers/ShapesEntityHandler';
export * from './constants';
export * from './definitions/ShapesDefinition';

// UI layer exports
export { ShapesUIPlugin } from './ui/ShapesUIPlugin';

// Default export for UI Plugin
export { ShapesUIPlugin as default } from './ui/ShapesUIPlugin';
