import {
  assertProjectRelativePath,
  createIdeGsmProjectRootNodeData,
  type IdeGsmProjectRootNodeData,
} from '@hierarchidb/idegsm-project-api';
import type { PluginStepConfig, PluginStepProps, StepData } from '@hierarchidb/plugin-base';
import {
  createEmptyIdeGsmConnectionDraft,
  IdeGsmConnectionStep,
  validateIdeGsmConnectionDraft,
} from '@hierarchidb/ui-ide-gsm-connection';
import { createElement } from 'react';
import { IDEGSM_PROJECT_PLUGIN_NODE_TYPE } from '../../common/constants.js';
import { IdeGsmProjectPathStep } from './steps/IdeGsmProjectPathStep.js';
import type { IdeGsmProjectDialogData, IdeGsmProjectRuntime } from './steps-provider-types.js';

const hasConnectionName = (data?: IdeGsmProjectDialogData): boolean =>
  typeof data?.connectionName === 'string' && data.connectionName.length > 0;

const hasProjectRelativePath = (data?: IdeGsmProjectDialogData): boolean => {
  try {
    assertProjectRelativePath(data?.projectRelativePath, 'projectRelativePath');
    return true;
  } catch {
    return false;
  }
};

const hasProjectIdentity = (data?: IdeGsmProjectDialogData): boolean =>
  hasConnectionName(data) && hasProjectRelativePath(data);

export function createIdeGsmProjectStepConfigProvider(runtime: IdeGsmProjectRuntime) {
  return {
    nodeType: IDEGSM_PROJECT_PLUGIN_NODE_TYPE,
    getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<IdeGsmProjectDialogData>> {
      if (!runtime.enabled) return [];
      const connectionRuntime = runtime.connectionRuntime;
      if (!connectionRuntime) return [];
      return [
        {
          id: 'connection',
          label: 'Connection',
          componentFactory: (props: PluginStepProps<IdeGsmProjectDialogData>) =>
            createElement(IdeGsmConnectionStep, {
              value: {
                ...createEmptyIdeGsmConnectionDraft(),
                connectionName: props.data.connectionName ?? '',
              },
              disabled: props.disabled,
              provider: connectionRuntime,
              onChange: (next) => {
                props.onChange({
                  ...props.data,
                  connectionName: next.connectionName,
                });
              },
              onPersistedValueChange: (value) =>
                props.onChange({
                  ...props.data,
                  connectionName: value?.connectionName,
                }),
            }),
          validate: (data?: IdeGsmProjectDialogData) => hasConnectionName(data),
          capabilities: {
            canProceedToNext: (data?: IdeGsmProjectDialogData) => hasConnectionName(data),
            beforeNavigateNext: async (data, context) => {
              context.setPhase('Validating connection');
              const validated = await validateIdeGsmConnectionDraft(
                {
                  ...createEmptyIdeGsmConnectionDraft(),
                  connectionName: data.connectionName ?? '',
                },
                connectionRuntime
              );
              if (!validated.ok) {
                return { type: 'stay', reason: validated.code };
              }
              return {
                type: 'advance',
                canonicalData: {
                  ...data,
                  connectionName: validated.value.connectionName,
                },
              };
            },
          },
        },
        {
          id: 'project-path',
          label: 'Project Path',
          componentFactory: (props: PluginStepProps<IdeGsmProjectDialogData>) =>
            createElement(IdeGsmProjectPathStep, props),
          validate: (data?: IdeGsmProjectDialogData) => hasProjectIdentity(data),
          capabilities: {
            canSave: (data?: IdeGsmProjectDialogData) => hasProjectIdentity(data),
            canProceedToNext: (data?: IdeGsmProjectDialogData) => hasProjectIdentity(data),
            beforeNavigateNext: async (data, context) => {
              if (!hasProjectIdentity(data)) {
                return { type: 'stay', reason: 'PROJECT_IDENTITY_INCOMPLETE' };
              }
              const connectionName = data.connectionName;
              const projectRelativePath = data.projectRelativePath;
              if (typeof connectionName !== 'string' || typeof projectRelativePath !== 'string') {
                return { type: 'stay', reason: 'PROJECT_IDENTITY_INCOMPLETE' };
              }
              assertProjectRelativePath(projectRelativePath, 'projectRelativePath');
              context.setCancellable(false);
              if (runtime.resolveProjectPath) {
                context.setPhase('Resolving project');
                const resolved = await runtime.resolveProjectPath({
                  connectionName,
                  projectRelativePath,
                  signal: context.signal,
                });
                assertProjectRelativePath(resolved.projectRelativePath, 'projectRelativePath');
                return {
                  type: 'advance',
                  canonicalData: createIdeGsmProjectRootNodeData({
                    connectionName,
                    projectRelativePath: resolved.projectRelativePath,
                  }) as IdeGsmProjectRootNodeData & StepData,
                };
              }
              return {
                type: 'advance',
                canonicalData: createIdeGsmProjectRootNodeData({
                  connectionName,
                  projectRelativePath,
                }) as IdeGsmProjectRootNodeData & StepData,
              };
            },
          },
        },
      ];
    },
    getEditStepConfigs(): ReadonlyArray<PluginStepConfig<IdeGsmProjectDialogData>> {
      return this.getCreateStepConfigs();
    },
  };
}
