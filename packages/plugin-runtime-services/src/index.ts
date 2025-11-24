export { BaseEntityService } from './entity/BaseEntityService.js';
export {
  createDraftBase,
  markDraftUpdated,
  type CreateDraftBaseParams,
} from './entity/workingCopy.js';

export {
  createDownloadService,
  downloadWithService,
  type DownloadServiceHandle,
  type DownloadTaskOptions,
  type ManagedDownloadOutcome,
} from './download/downloadService.js';
