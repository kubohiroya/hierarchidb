/**
 * Extended version of DescendantNodeJson that includes node IDs for proper import/export
 */

import type { TreeNodeId } from '@hierarchidb/core';
import { DescendantNodeJson } from '../state/DescendantNodeJson';

export type DescendantNodeJsonWithId = DescendantNodeJson & {
  id: TreeNodeId;
  children?: DescendantNodeJsonWithId[];
};
