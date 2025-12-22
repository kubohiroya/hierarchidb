
import './i18n.js';

type PluginDialogComponent = (props: HostPluginDialogProps) => JSX.Element | null;

interface HostPluginDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit' | string;
  nodeId?: unknown;
  parentId?: unknown;
  onSuccess?: (entity: unknown) => void;
  onError?: (error: Error) => void;
}

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const Adapter: PluginDialogComponent = () => {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[route-plugin] getDialogComponent() is deprecated. Dialogs are provided via PluginDialogHost.');
    }
    return null;
  };
  return Adapter;
}
