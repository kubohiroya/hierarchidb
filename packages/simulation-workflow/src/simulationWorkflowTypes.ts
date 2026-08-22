/** Names of each step in the simulation workflows. */
export type StepName = 'import' | 'calibrate' | 'simulate' | 'export' | 'rsync-push' | 'rsync-pull';

/** Status of a workflow step. */
export type StepStatus = 'running' | 'done' | 'failed';

/** Callback invoked when a step changes status. */
export type OnStepChange = (step: StepName, status: StepStatus) => void;

/** Connection type for rsync operations. */
export type ConnectionType = 'remote' | 'ssh' | 'ec2';

/**
 * Optional file-glob filter for rsyncPush / rsyncPull.
 * When omitted, IDE-GSM applies its own default filter.
 */
export interface RsyncFilter {
  include?: string[];
  exclude?: string[];
}
