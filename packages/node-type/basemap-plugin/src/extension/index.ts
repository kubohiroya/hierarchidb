/**
 * @file extension/index.ts
 * @description BaseMap extension exports
 */

export { BaseMapExtension } from './definition';
export type { BaseMapEntity, BaseMapWorkingCopy } from './definition';

// Step components
export { MapStyleStep } from './components/MapStyleStep';
export { MapViewportStep } from './components/MapViewportStep';
export { DisplayOptionsStep } from './components/DisplayOptionsStep';