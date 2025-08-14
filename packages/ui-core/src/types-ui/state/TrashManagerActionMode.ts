/**
 * Mode for trash management operations
 */
export const TrashManagerActionModes = {
  RESTORE_ITEM: 'restore',
  EMPTY_TRASH: 'empty',
} as const;

export type TrashManagerActionMode =
  (typeof TrashManagerActionModes)[keyof typeof TrashManagerActionModes];
