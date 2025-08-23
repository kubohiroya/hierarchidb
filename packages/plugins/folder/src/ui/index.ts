/**
 * UI layer exports
 */

// Plugin definition
export { FolderUIPlugin } from './plugin';

// Hooks
export * from './hooks';

// Components (lazy-loaded)
export const FolderComponents = {
  get FolderCreateDialog() {
    return import('../components/FolderCreateDialog').then(m => m.FolderCreateDialog);
  },
  get FolderEditDialog() {
    return import('../components/FolderEditDialog').then(m => m.FolderEditDialog);
  },
  get FolderIcon() {
    return import('../components/FolderIcon').then(m => m.FolderIcon);
  }
};