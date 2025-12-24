import type { NodeId } from '@hierarchidb/common-types';
import { v4 as uuidv4 } from 'uuid';

export const generateNodeId = (): NodeId => uuidv4() as NodeId;
