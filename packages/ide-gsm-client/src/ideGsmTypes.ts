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
  runId: string | null;
  jobId: string | null;
  workflowId: string | null;
  executionKind: string | null;
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
  runId: string | null;
  jobId: string | null;
  workflowId: string | null;
  executionKind: string | null;
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

export type FdmRuntimeBackendType = 'API' | 'BATCH' | 'EC2' | 'LOCAL' | 'MCP' | 'REMOTE' | 'SSH';

export type FdmRuntimePhase =
  | 'ACCEPTED'
  | 'CANCELED'
  | 'FAILED'
  | 'PROGRESS'
  | 'STARTED'
  | 'SUCCEEDED';

export interface FdmDashboardStatusInput {
  spaceId: string;
  parameterSet?: string;
  profile?: string;
  dataset?: string;
  compute?: string;
  timeline?: string;
  stateDir?: string;
}

export interface FdmCellDetailInput {
  spaceId: string;
  parameterSet: string;
  dataset: string;
  compute: string;
  timelinePoint: string;
  label?: string;
  stateDir?: string;
  /** @deprecated Use parameterSet. */
  profile?: string;
  /** @deprecated Use timelinePoint. */
  checkpoint?: string;
}

export interface FdmCellLogInput extends FdmCellDetailInput {}

export interface FdmRuntimeDiagnosticsInput extends ProjectCommandInput {}

export interface FdmRuntimeEventsInput extends ProjectCommandInput {
  stateDir?: string;
}

export interface FdmCellStageIdentity {
  parameterSet: string | null;
  profile: string | null;
  dataset: string | null;
  compute: string | null;
  timelinePoint: string | null;
  checkpoint: string | null;
  label: string | null;
  source: string | null;
}

export interface FdmDashboardLivePayload {
  status: string | null;
  startedAt: string | null;
}

export interface FdmDashboardStatePayload {
  status: string | null;
}

export interface FdmLockStatus {
  active: boolean;
  acquiredAt: string | null;
  ageMillis: number | null;
  fileName: string | null;
  host: string | null;
  owner: string | null;
  pid: number | null;
  role: string | null;
  staleMetadata: boolean;
}

export interface FdmDashboardStartupStatus {
  ready: boolean;
  phase: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  waitedMillis: number;
  waitingForHolder: string | null;
  apiStartupLock: FdmLockStatus | null;
  simulatorLock: FdmLockStatus | null;
}

export interface FdmDashboardCell {
  parameterSet: string | null;
  profile: string | null;
  dataset: string | null;
  compute: string | null;
  timelinePoint: string | null;
  checkpoint: string | null;
  label: string | null;
  source: string | null;
  bucket: string | null;
  rawStatus: string | null;
  accuracyLabel: string | null;
  summaryFile: string | null;
  current: boolean;
  next: boolean;
  blockingDrift: boolean;
  variantCount: number;
}

export interface FdmDashboardStatusPayload {
  generatedAt: string | null;
  selectedSpaceId: string | null;
  selectedStateDir: string | null;
  availableStateDirs: readonly string[] | null;
  parameterSet: readonly string[] | null;
  profile: readonly string[] | null;
  dataset: readonly string[] | null;
  compute: readonly string[] | null;
  timeline: readonly string[] | null;
  state: FdmDashboardStatePayload | null;
  live: FdmDashboardLivePayload | null;
  startup: FdmDashboardStartupStatus | null;
  cells: readonly FdmDashboardCell[] | null;
}

export interface FdmCellDetailPayload {
  generatedAt: string | null;
  selectedStateDir: string | null;
  stage: FdmCellStageIdentity | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number | null;
  estimatedRemainingMs: number | null;
  estimatedCompletedAt: string | null;
  logPath: string | null;
  latestLogLines: readonly string[] | null;
}

export interface FdmCellLogStreamPayload {
  generatedAt: string | null;
  stage: FdmCellStageIdentity | null;
  logPath: string | null;
  latestLogLines: readonly string[] | null;
}

export type FdmCellLogListener = (event: FdmCellLogStreamPayload) => void;

export interface FdmRuntimeEventPayload {
  backendType: FdmRuntimeBackendType | null;
  command: string | null;
  compute: string | null;
  connectionType: string | null;
  message: string | null;
  phase: FdmRuntimePhase | null;
  progress: number | null;
  projectRelativePath: string | null;
  receivedAt: string | null;
  recovered: boolean;
  taskId: string | null;
  username: string | null;
  backendMetadata: Readonly<Record<string, string>>;
}

export type FdmRuntimeEventListener = (event: FdmRuntimeEventPayload) => void;

export interface FdmRecoveredStateDiagnostics {
  command: string | null;
  compute: string | null;
  connectionType: string | null;
  launchLogFile: string | null;
  launchPid: string | null;
  launchPlanName: string | null;
  liveStatus: string | null;
  message: string | null;
  phase: string | null;
  recovered: boolean;
  runtimeIdentity: string | null;
  stateDir: string | null;
  taskId: string | null;
}

export interface FdmRuntimeDiagnosticsPayload {
  generatedAt: string | null;
  startup: FdmDashboardStartupStatus | null;
  recoveredStates: readonly FdmRecoveredStateDiagnostics[] | null;
}

export interface FdmVerifyInput {
  spaceId: string;
  planName?: string;
  parameterSet?: string[];
  profile?: string[];
  dataset?: string[];
  computeEngine?: string[];
  timeline?: string[];
  sources?: string[];
  stateDir?: string;
  defaultCompute?: string;
  targetComputes?: string[];
  baselineCompute?: string;
  compareSelectors?: string;
  tolerance?: string;
  toleranceProfile?: string;
  snapshotLevel?: string;
  snapshotPolicy?: string;
  compatibleSnapshotCommits?: string[];
  compatibleSnapshotRevisions?: string[];
  axisPriority?: string[];
  benchmarkAggregateMode?: string;
  remoteInventoryFile?: string;
  remoteLabel?: string;
  sshProfile?: string;
  originalSourceParameterSet?: string;
  originalSourceProfile?: string;
  originalSourceProjectDir?: string;
  preflight?: boolean;
}

export interface FdmLifecycleInput {
  spaceId?: string;
  workflowId?: string;
  runId?: string;
  jobId?: string;
  taskId?: string;
  operationId?: string;
  stateDir?: string;
  executionKind?: string;
}

export interface FdmCapabilitiesPayload {
  capabilities: readonly FdmCapability[] | null;
  workflows: readonly FdmWorkflow[] | null;
  runs: readonly FdmRun[] | null;
  jobs: readonly FdmJob[] | null;
  rulesets: readonly FdmRuleset[] | null;
  baselines: readonly FdmBaseline[] | null;
  forks: readonly FdmFork[] | null;
  lineage: readonly FdmLineage[] | null;
}

export interface FdmCapability {
  level: string | null;
  name: string | null;
  note: string | null;
  operations: readonly string[] | null;
  supported: boolean;
}

export interface FdmLifecycleDiagnostic {
  code: string | null;
  message: string | null;
  path: string | null;
  severity: string | null;
}

export interface FdmWorkflow {
  capabilities: readonly string[] | null;
  workflowId: string | null;
  runId: string | null;
  stateDir: string | null;
  status: string | null;
  sourceFile: string | null;
  sourceRevision: string | null;
}

export interface FdmRun {
  capabilities: readonly string[] | null;
  diagnostics: readonly FdmLifecycleDiagnostic[] | null;
  operations: readonly FdmRunOperation[] | null;
  projectionConsistent: boolean;
  runId: string | null;
  stateDir: string | null;
  status: string | null;
  workflowId: string | null;
}

export interface FdmRunOperation {
  attemptId: string | null;
  disposition: string | null;
  evidence: readonly string[] | null;
  operationId: string | null;
  outcome: string | null;
  status: string | null;
  updatedAt: string | null;
}

export interface FdmJob {
  capabilities: readonly string[] | null;
  diagnostics: readonly FdmLifecycleDiagnostic[] | null;
  executionKind: string | null;
  jobId: string | null;
  operationId: string | null;
  runId: string | null;
  status: string | null;
  taskId: string | null;
  workflowId: string | null;
}

export interface FdmRuleset {
  capabilities: readonly string[] | null;
  operations: readonly string[] | null;
  reference: string | null;
  roles: readonly string[] | null;
  rulesetId: string | null;
  version: number | null;
}

export interface FdmBaseline {
  baselineId: string | null;
  capabilities: readonly string[] | null;
  computeEngine: string | null;
  dataset: string | null;
  profile: string | null;
  source: string | null;
  timelinePoint: string | null;
}

export interface FdmFork {
  capabilities: readonly string[] | null;
  forkId: string | null;
  sourceRunId: string | null;
  sourceWorkflowId: string | null;
  status: string | null;
  targetRunId: string | null;
  targetWorkflowId: string | null;
}

export interface FdmLineage {
  capabilities: readonly string[] | null;
  lineageId: string | null;
  operationId: string | null;
  runId: string | null;
  sourceOperationId: string | null;
  sourceRunId: string | null;
  workflowId: string | null;
}

export interface IdeGsmFdmResolvedPathContext {
  allowedProjectRoots: readonly string[] | null;
  allowedProjectRootsSource: string | null;
  fdmDirectory: string | null;
  fdmDirectorySource: string | null;
  fixtureDirectory: string | null;
  fixtureDirectorySource: string | null;
}

export interface FdmVerifyReport {
  axisPriority: readonly string[] | null;
  baselineCompute: string | null;
  benchmarkAggregateMode: string | null;
  calibrationRuntimeOptions: Readonly<Record<string, string>>;
  command: readonly string[] | null;
  compareSelectors: string | null;
  compatibleSnapshotCommits: readonly string[] | null;
  compatibleSnapshotRevisions: readonly string[] | null;
  compute: readonly string[] | null;
  dataset: readonly string[] | null;
  dryRun: boolean;
  executionKind: string | null;
  logFile: string | null;
  pathContext: IdeGsmFdmResolvedPathContext | null;
  pid: number;
  planFile: string | null;
  planName: string | null;
  profile: readonly string[] | null;
  remoteDataset: readonly string[] | null;
  remoteInventoryFile: string | null;
  remoteLabel: string | null;
  runId: string | null;
  snapshotLevel: string | null;
  snapshotPolicy: string | null;
  snapshotReusePolicy: string | null;
  sources: readonly string[] | null;
  sshCompute: readonly string[] | null;
  sshProfile: string | null;
  stateDir: string | null;
  stateSegment: string | null;
  timeline: readonly string[] | null;
  tolerance: string | null;
  toleranceProfile: string | null;
  useSharedBaseline: boolean;
  workflowId: string | null;
}

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
