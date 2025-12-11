import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import { useTranslation } from '@hierarchidb/ui-i18n';

type FolderDraftData = {
  nodeId?: NodeId;
  name?: string;
  description?: string;
  tags?: string[];
};

export interface FolderDialogHostProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  onClose: () => void;
  onSave?: (data: FolderDraftData) => Promise<void>;
}

export const FolderDialogHost: React.FC<FolderDialogHostProps> = ({
  open,
  mode,
  nodeId,
  parentId,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation('folder-plugin');
  const { frameStyle, dialogRef, headlessProps } = useTreeNodeDialog<FolderDraftData>({
    open,
    mode,
    nodeType: 'folder',
    useSingleSource: true,
    nodeId,
    parentId,
    onClose,
    initialDraftMetadata: {
      name: resolveDefaultNodeName('folder'),
      description: '',
      tags: [],
    },
    buildSteps: ({ metadata, persistBasicInfo, mode }) => [
      {
        id: 'basic',
        label: t('steps.basic.label', 'Basic Information'),
        component: (
          <BasicInfoStep
            name={metadata?.name ?? ''}
            description={metadata?.description ?? ''}
            tags={metadata?.tags ?? []}
            mode={mode}
            onChange={(value: BasicInfoData) =>
              persistBasicInfo({
                name: value.name,
                description: value.description ?? '',
                tags: value.tags ?? [],
              })
            }
            validate={(value: BasicInfoData) =>
              value.name.trim().length ? null : t('errors.nameRequired', 'Name is required')}
          />
        ),
        validate: () => Boolean(metadata?.name?.trim()),
      },
    ],
    onSave: async (_meta: TreeNodeMetadata, savedId?: NodeId) => {
      if (onSave) {
        await onSave({ nodeId: savedId });
      }
    },
  });

  const isDirty = mode === 'edit' ? Boolean(headlessProps.isDirty) : true;
  const adjustedHeadlessProps = {
    ...headlessProps,
    isDirty,
    committableStepIndices: isDirty ? headlessProps.committableStepIndices ?? [0] : [],
    onRequestCommit: isDirty ? headlessProps.onRequestCommit : undefined,
  };

  return (
    <div style={frameStyle} role="dialog" aria-modal={open} ref={dialogRef}>
      <HeadlessMultiStepDialog<FolderDraftData> {...adjustedHeadlessProps} />
    </div>
  );
};

FolderDialogHost.displayName = 'FolderDialogHost';
