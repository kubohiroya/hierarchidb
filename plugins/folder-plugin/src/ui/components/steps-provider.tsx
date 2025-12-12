import { PluginStepRegistry, type StepComponentProps, type StepData } from '@hierarchidb/plugin-base';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import type { TreeNodeMetadata, NodeId } from '@hierarchidb/common-types';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import { i18n } from '@hierarchidb/ui-i18n';

const registry = PluginStepRegistry.getInstance();

type FolderStepData = StepData & {
  treeNodeId?: NodeId;
  draftMetadata?: TreeNodeMetadata | null;
};

const ensureDraft = (data?: FolderStepData): FolderStepData => {
  const meta = data?.draftMetadata ?? {
    name: resolveDefaultNodeName('folder'),
    description: '',
    tags: [],
  };
  return {
    treeNodeId: data?.treeNodeId,
    draftMetadata: meta,
  };
};

registry.registerConfigProvider<FolderStepData>({
  nodeType: 'folder',
  getCreateStepConfigs() {
    const t = (key: string, defaultValue: string) =>
      i18n.t(key, { defaultValue, ns: 'folder-plugin' });
    return [
      {
        id: 'basic',
        label: t('steps.basic.label', 'Basic Information'),
        componentFactory: (p: StepComponentProps<FolderStepData>) => {
          const draft = ensureDraft(p.data);
          const meta = draft.draftMetadata ?? {
            name: resolveDefaultNodeName('folder'),
            description: '',
            tags: [],
          };
          return (
            <BasicInfoStep
              name={meta.name ?? ''}
              description={meta.description ?? ''}
              tags={meta.tags ?? []}
              mode={p.mode}
              onChange={({ name, description, tags }: BasicInfoData) =>
                p.onChange({
                  ...draft,
                  draftMetadata: { ...meta, name, description: description ?? '', tags: tags ?? [] },
                })
              }
              validate={(value: BasicInfoData) =>
                value.name.trim().length ? null : t('errors.nameRequired', 'Name is required')
              }
            />
          );
        },
        validate: (data?: FolderStepData) => {
          const meta = (data?.draftMetadata ?? null) as TreeNodeMetadata | null;
          return Boolean(meta?.name?.trim());
        },
      },
    ];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
