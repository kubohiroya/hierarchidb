import type { SxProps, Theme } from '@mui/material/styles';
import type { HeadlessDialogProps } from './types.js';

export interface PluginDialogFrameComponentProps<TData> {
  headlessProps: HeadlessDialogProps<TData>;
  /** Additional styles applied to the dialog frame container. */
  frameSx?: SxProps<Theme>;
  /** Additional styles applied to the backdrop element. */
  backdropSx?: SxProps<Theme>;
  /** Override z-index used for the backdrop + dialog (defaults to modal + 10). */
  zIndex?: number;
  /** Custom delay (ms) to ignore accidental backdrop clicks after drag/resize. */
  backdropIgnoreDelayMs?: number;
  /** Whether to stop wheel propagation to underlying content (default: true). */
  stopWheelPropagation?: boolean;
  /** Render dialog in-place instead of portal mounting. */
  disablePortal?: boolean;
  /** Custom container for the portal. Defaults to document.body when available. */
  portalContainer?: Element | DocumentFragment | null;
  /** Duration (ms) for the fade transition when the dialog mounts/unmounts. */
  transitionDuration?: number;
  /** Whether clicking the backdrop should request close (default: true). */
  backdropDismissEnabled?: boolean;
}
