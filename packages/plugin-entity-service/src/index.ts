export { BaseEntityService } from './entity/BaseEntityService.js';
export {
  createDraftWorkingCopyBase,
  markWorkingCopyUpdated,
  type CreateDraftWorkingCopyParams,
} from './entity/workingCopy.js';

export {
  createDownloadService,
  downloadWithService,
  type DownloadServiceHandle,
  type DownloadTaskOptions,
  type ManagedDownloadOutcome,
} from './download/downloadService.js';
