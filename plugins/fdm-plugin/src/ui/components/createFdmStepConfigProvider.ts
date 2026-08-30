import {
  assertFdmNodeData,
  assertFdmPromotionResult,
  createFdmNodeDataFromDraft,
  type FdmNodeData,
} from '@hierarchidb/fdm-api';
import type { PluginStepConfig, PluginStepProps, StepData } from '@hierarchidb/plugin-base';
import {
  createEmptyIdeGsmConnectionDraft,
  IdeGsmConnectionStep,
  validateIdeGsmConnectionDraft,
} from '@hierarchidb/ui-ide-gsm-connection';
import { createElement } from 'react';
import { FDM_PLUGIN_NODE_TYPE } from '../../common/constants.js';
import type { FdmPluginDialogData, FdmPluginRuntime } from './fdmStepProviderTypes.js';
import { FdmSpaceSelectionStep } from './steps/FdmSpaceSelectionStep.js';

const hasConnectionName = (data?: FdmPluginDialogData): boolean =>
  typeof data?.connectionName === 'string' && data.connectionName.length > 0;

const hasSpaceId = (data?: FdmPluginDialogData): boolean =>
  typeof data?.spaceId === 'string' &&
  data.spaceId.length > 0 &&
  data.spaceId.trim() === data.spaceId;

const hasFdmIdentity = (data?: FdmPluginDialogData): boolean =>
  hasConnectionName(data) && hasSpaceId(data);

export function createFdmStepConfigProvider(runtime: FdmPluginRuntime) {
  return {
    nodeType: FDM_PLUGIN_NODE_TYPE,
    getCreateStepConfigs(): ReadonlyArray<PluginStepConfig<FdmPluginDialogData>> {
      if (!runtime.enabled) return [];
      const connectionRuntime = runtime.connectionRuntime;
      const fdmRuntime = runtime.fdmRuntime;
      if (!connectionRuntime || !fdmRuntime) return [];
      return [
        {
          id: 'connection',
          label: 'Connection',
          componentFactory: (props: PluginStepProps<FdmPluginDialogData>) =>
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
                  spaceId:
                    next.connectionName === props.data.connectionName
                      ? props.data.spaceId
                      : undefined,
                });
              },
              onPersistedValueChange: (value) =>
                props.onChange({
                  ...props.data,
                  connectionName: value?.connectionName,
                  spaceId:
                    value?.connectionName === props.data.connectionName
                      ? props.data.spaceId
                      : undefined,
                }),
              children: ({ persistedValue, health }) =>
                createElement(FdmSpaceSelectionStep, {
                  data: props.data,
                  persistedConnection: persistedValue,
                  health,
                  runtime,
                  disabled: props.disabled,
                  onChange: props.onChange,
                }),
            }),
          validate: (data?: FdmPluginDialogData) => hasFdmIdentity(data),
          capabilities: {
            canProceedToNext: (data?: FdmPluginDialogData) => hasFdmIdentity(data),
            beforeNavigateNext: async (data, context) => {
              context.setPhase('Validating connection');
              const validatedConnection = await validateIdeGsmConnectionDraft(
                {
                  ...createEmptyIdeGsmConnectionDraft(),
                  connectionName: data.connectionName ?? '',
                },
                connectionRuntime
              );
              if (!validatedConnection.ok) {
                return { type: 'stay', reason: validatedConnection.code };
              }
              if (!hasSpaceId(data)) {
                return { type: 'stay', reason: 'FDM_SPACE_REQUIRED' };
              }
              context.setPhase('Preparing FDM node');
              const draft = {
                ...data,
                connectionName: validatedConnection.value.connectionName,
              };
              createFdmNodeDataFromDraft(
                draft,
                context.mode === 'edit' ? (context.dialogData as FdmNodeData) : undefined
              );
              context.setCancellable(false);
              context.setPhase('Committing FDM node');
              const promoted = await fdmRuntime.promoteNode({
                mode: context.mode,
                treeId: context.treeId,
                nodeId: context.nodeId,
                parentId: context.parentId,
                currentNodeVersion: context.currentNodeVersion,
                draft,
                signal: context.signal,
                setPhase: context.setPhase,
                setCancellable: context.setCancellable,
              });
              assertFdmPromotionResult(promoted);
              assertFdmNodeData(promoted.data);
              return {
                type: 'advance',
                nodeId: promoted.nodeId,
                nodeVersion: promoted.nodeVersion,
                canonicalData: promoted.data as FdmNodeData & StepData,
              };
            },
          },
        },
      ];
    },
    getEditStepConfigs(): ReadonlyArray<PluginStepConfig<FdmPluginDialogData>> {
      return this.getCreateStepConfigs();
    },
  };
}
