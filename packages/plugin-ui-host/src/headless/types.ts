export type DialogActionInFlight =
  | { type: 'back' | 'next' | 'commit' | 'cancel' | 'save-draft' }
  | { type: 'step'; index: number };
