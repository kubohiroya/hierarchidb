export { FolderEntityHandler } from './handlers/FolderEntityHandler';
export { FolderDatabase } from './database/FolderDatabase';

// Basic components
// UI components exported via subpath './ui' to keep root worker-safe

// Export types
export * from './types';
export * from './entities/FolderEntity';

// Export plugin definition for worker consumption
export { FolderDefinition } from './definitions/FolderDefinition';
