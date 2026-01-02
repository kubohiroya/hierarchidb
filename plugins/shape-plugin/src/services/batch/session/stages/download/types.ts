import type { NodeId } from '@hierarchidb/common-types';
import type { DataSourceName, DownloadTaskPayload, ProcessingStage } from '../../../../common/types/index.js';
import type { BatchProcessConfig } from '../../../batch/types.js';

export type DownloadStageContext = {
  nodeId: NodeId;
  config: BatchProcessConfig;
  downloadTaskPayloads: DownloadTaskPayload[];
  resolveDataSource: () => DataSourceName;
  setCurrentStage: (stage: ProcessingStage) => void;
};

