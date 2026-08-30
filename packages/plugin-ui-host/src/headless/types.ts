export type DialogActionInFlight =
  | { type: 'back' | 'next' | 'commit' | 'cancel' | 'save-draft' }
  | { type: 'step'; index: number };

export interface StepTransitionDialogState {
  open: boolean;
  title: string;
  phase: string;
  cancellable: boolean;
  error: string | null;
  onCancel?: () => void;
  onDismiss?: () => void;
}
