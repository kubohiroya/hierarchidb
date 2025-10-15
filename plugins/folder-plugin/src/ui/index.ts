export { FolderIcon } from './components/FolderIcon.js';
export { FolderCreateDialog } from './components/FolderCreateDialog.js';
export { FolderEditDialog } from './components/FolderEditDialog.js';
export type { FolderDialogProps } from './components/FolderDialog.js';

// Standardized entry for PluginDialogRoute: provide getDialogComponent()
export async function getDialogComponent() {
  const mod = await import('./components/FolderDialog.js');
  return mod.FolderDialog;
}

// Register folder host profile so PluginDialog can compose base steps for
// plugin-loader that extend 'folder'. Safe to import for side-effects.
import './folder-host';
