import type { HeadlessDialogProps } from './types.js';
import { AbstractDialog } from './AbstractDialog.js';

export function HeadlessPluginDialog<TData>(props: HeadlessDialogProps<TData>) {
  return <AbstractDialog {...props} />;
}
