import type { NodeType } from '@hierarchidb/core-types';
import { FDM_NODE_TYPE } from '@hierarchidb/fdm-api';

export const FDM_PLUGIN_ID = '@hierarchidb/fdm-plugin' as const;
export const FDM_PLUGIN_VERSION = '0.1.0' as const;
export const FDM_PLUGIN_NODE_TYPE = FDM_NODE_TYPE as NodeType;
export const FDM_PLUGIN_FEATURE_FLAG_DEFAULT = true as const;
