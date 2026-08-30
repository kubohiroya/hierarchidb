/** Task status values exposed by the pinned IDE-GSM upstream revision. */
export type TaskStatus =
  | 'REGISTERED'
  | 'READY'
  | 'LEASED'
  | 'FINISHED'
  | 'FAILED'
  | 'CANCELED'
  | 'DELETED';

/** Payload received from the subscribeTaskOnFrontend WebSocket subscription. */
export interface TaskResult {
  id: string;
  status: TaskStatus;
  paramsJson: string;
  resultJson: string | null;
}

/** Receives validated task status updates, including active statuses. */
export type TaskStatusListener = (result: TaskResult) => void;

export type ActiveProjectTaskStatus = Exclude<TaskStatus, 'DELETED'>;

export interface ActiveProjectTask {
  taskId: string;
  commandId: IdeGsmCommandId;
  status: ActiveProjectTaskStatus;
  projectRelativePath: string;
  progress: number | null;
  phase: string | null;
  registeredAt: string;
  startedAt: string | null;
  updatedAt: string;
}

export interface TaskCancelResult {
  taskId: string;
  accepted: boolean;
}

export interface TaskLogEvent {
  taskId: string;
  sequence: number;
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export type TaskLogListener = (event: TaskLogEvent) => void;

/** Optional file-glob filter for exportProject. */
export interface ExportFilter {
  include?: string[];
  exclude?: string[];
}

/** Connection configuration selected for an rsync command. */
export type RsyncConnectionType = 'remote' | 'ssh' | 'ec2';

/** Optional rsync patterns parsed from rsync.yml. */
export interface RsyncFilter {
  include?: string[];
  exclude?: string[];
}

export interface ProjectCommandInput {
  projectRelativePath: string;
}

export interface ProjectFileInput extends ProjectCommandInput {
  relativePath: string;
}

export interface ProjectYamlFileContentInput extends ProjectFileInput {}

export interface ProjectYamlFileContent {
  projectRelativePath: string;
  relativePath: string;
  content: string;
  contentDigest: string;
  updatedAt: string;
  byteCount: number;
}

export interface ProjectFileContentTransferInput extends ProjectFileInput {}

export interface ProjectFileContentTransfer {
  transferId: string;
  contentDigest: string;
  updatedAt: string;
  byteCount: number;
  chunkSizeBytes: number;
  expiresAt: string;
}

export interface ProjectFileContentPageInput {
  transferId: string;
  cursor?: string;
}

export interface ProjectFileContentPage {
  contentChunkBase64: string;
  rawByteCount: number;
  nextCursor: string | null;
  hasNext: boolean;
}

export type ProjectYamlWriteStatus =
  | 'UPDATED'
  | 'CONTENT_CONFLICT'
  | 'FILE_LOCK_UNAVAILABLE'
  | 'ATOMIC_REPLACE_UNAVAILABLE'
  | 'AUTHORIZATION_FAILED';

export interface ConditionalProjectYamlWriteInput extends ProjectFileInput {
  expectedDigest: string;
  content: string;
}

export interface ConditionalProjectYamlWriteResult {
  status: ProjectYamlWriteStatus;
  projectRelativePath: string;
  relativePath: string;
  contentDigest: string | null;
  updatedAt: string | null;
  byteCount: number | null;
  resyncRequired: boolean;
}

export interface InstallCommandInput extends ProjectCommandInput {
  force?: boolean;
}

export interface PreviewEventsCommandInput extends ProjectCommandInput {
  profile?: string;
  yearFilter?: number;
}

export interface SimulateCommandInput extends ProjectCommandInput {
  profile?: string;
  compute?: string;
  apsp?: string;
  purgeCache?: boolean;
  reset?: boolean;
}

export interface CalibrateCommandInput extends SimulateCommandInput {
  purgeCalib?: boolean;
}

export interface RemoteSimulateCommandInput extends ProjectCommandInput {
  compute?: string;
  apsp?: string;
  purgeCache?: boolean;
  reset?: boolean;
  downloadCache?: boolean;
}

export interface RemoteCalibrateCommandInput extends RemoteSimulateCommandInput {
  purgeCalib?: boolean;
}

export interface RsyncCommandInput extends ProjectCommandInput, RsyncFilter {
  connectionType: RsyncConnectionType;
}

export interface InitCommandInput extends ProjectCommandInput {
  githubToken: string;
  url: string;
}

/** Canonical YAML Step 4 command IDs. */
export const IDE_GSM_COMMAND_IDS = [
  'install',
  'check',
  'check-merge',
  'preview-events',
  'calib',
  'sim',
  'purge-cache',
  'calib-remote',
  'sim-remote',
  'start-container-remote',
  'stop-container-remote',
  'calib-ssh',
  'sim-ssh',
  'calib-ec2',
  'sim-ec2',
  'start-container-ec2',
  'stop-container-ec2',
  'rsync-push',
  'rsync-pull',
  'init',
] as const;

export type IdeGsmCommandId = (typeof IDE_GSM_COMMAND_IDS)[number];

/** Canonical command and input pairs for exhaustive Step 4 dispatch. */
export type IdeGsmCommand =
  | { id: 'install'; input: InstallCommandInput }
  | { id: 'check'; input: ProjectCommandInput }
  | { id: 'check-merge'; input: ProjectCommandInput }
  | { id: 'preview-events'; input: PreviewEventsCommandInput }
  | { id: 'calib'; input: CalibrateCommandInput }
  | { id: 'sim'; input: SimulateCommandInput }
  | { id: 'purge-cache'; input: ProjectCommandInput }
  | { id: 'calib-remote'; input: RemoteCalibrateCommandInput }
  | { id: 'sim-remote'; input: RemoteSimulateCommandInput }
  | { id: 'start-container-remote'; input: ProjectCommandInput }
  | { id: 'stop-container-remote'; input: ProjectCommandInput }
  | { id: 'calib-ssh'; input: RemoteCalibrateCommandInput }
  | { id: 'sim-ssh'; input: RemoteSimulateCommandInput }
  | { id: 'calib-ec2'; input: RemoteCalibrateCommandInput }
  | { id: 'sim-ec2'; input: RemoteSimulateCommandInput }
  | { id: 'start-container-ec2'; input: ProjectCommandInput }
  | { id: 'stop-container-ec2'; input: ProjectCommandInput }
  | { id: 'rsync-push'; input: RsyncCommandInput }
  | { id: 'rsync-pull'; input: RsyncCommandInput }
  | { id: 'init'; input: InitCommandInput };
