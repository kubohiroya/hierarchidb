import type { TreeNodeEntityWithChildren } from '../nodes';

export type DescendantNodeJson = Pick<
  TreeNodeEntityWithChildren,
  'name' | 'description' | 'type' | 'isDraft'
> & {
  hasChildren?: boolean;
  descendantsCount?: number;
  children?: DescendantNodeJson[];
};
