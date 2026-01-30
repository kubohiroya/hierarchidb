import type { TagId } from '@hierarchidb/core-types';

export type TagSuggestion = {
  id: TagId;
  name: string;
  color: string;
  usageCount: number;
};
