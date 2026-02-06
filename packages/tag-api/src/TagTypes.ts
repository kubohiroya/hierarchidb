import type { TagId } from './tag-entity-types.js';

export type TagSuggestion = {
  id: TagId;
  name: string;
  color: string;
  usageCount: number;
};
