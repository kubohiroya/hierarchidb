export { FolderIcon } from '../components/FolderIcon';
export { FolderCreateDialog } from '../components/FolderCreateDialog';
export { FolderEditDialog } from '../components/FolderEditDialog';
export { FolderDialog } from '../components/FolderDialog';

// Standardized entry for PluginDialogRoute: provide getDialogComponent()
export async function getDialogComponent() {
  const mod = await import('../components/FolderDialog');
  return (mod as any).FolderDialog;
}

// Register folder host profile so PluginDialog can compose base steps for
// plugins that extend 'folder'. Safe to import for side-effects.
import './folder-host';
