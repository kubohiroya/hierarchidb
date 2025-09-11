/**
  * UI layer exports - UI
  */

// Note: UI hooks reference an ambient module shim via triple-slash in the hook file.
// Do not import .d.ts files here to avoid bundler resolution errors.

// Components
export * from './components';

// Hooks
export * from './hooks';

// Plugin definition
export * from './plugin';

// Auth helpers
export * from './auth/setShapeAuthToken';
