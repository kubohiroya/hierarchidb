import type { NodeType } from '@hierarchidb/core-types';
import { IDEGSM_PROJECT_NODE_TYPE } from '@hierarchidb/idegsm-project-api';

export const IDEGSM_PROJECT_PLUGIN_ID = '@hierarchidb/idegsm-project-plugin' as const;
export const IDEGSM_PROJECT_PLUGIN_VERSION = '0.1.0' as const;
export const IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT = false as const;
export const IDEGSM_PROJECT_PLUGIN_NODE_TYPE = IDEGSM_PROJECT_NODE_TYPE as NodeType;
