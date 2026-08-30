import type { IdeGsmProjectRootNodeData } from '@hierarchidb/idegsm-project-api';
import type { IdeGsmConnectionRuntimeProvider } from '@hierarchidb/ui-ide-gsm-connection';

export type IdeGsmProjectDialogData = Partial<IdeGsmProjectRootNodeData>;

export interface IdeGsmProjectRuntime {
  readonly enabled: boolean;
  readonly connectionRuntime?: IdeGsmConnectionRuntimeProvider;
  readonly resolveProjectPath?: (input: {
    readonly connectionName: string;
    readonly projectRelativePath: string;
    readonly signal: AbortSignal;
  }) => Promise<{ readonly projectRelativePath: string }>;
}

export interface IdeGsmProjectRuntimeGlobal {
  __HDB_IDEGSM_PROJECT__?: IdeGsmProjectRuntime;
}
