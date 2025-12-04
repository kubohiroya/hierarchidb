import type { CSSProperties, RefObject } from 'react';
import type { NodeId, TreeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import { type BasicInfoData, BasicInfoStep } from '@hierarchidb/ui-plugin-basic-info';
import type { HeadlessMultiStepDialogProps } from '@hierarchidb/ui-dialog';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { SPREADSHEET_NODE_TYPE } from '../../common/constants.js';
import { DataSourceStep } from '../components/steps/DataSourceStep.js';
import { FilteringStep } from '../components/steps/FilteringStep.js';

export interface UseSpreadsheetDialogOptions {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave: (data: TreeNodeMetadata, nodeId?: NodeId) => Promise<void>;
}

const defaultSpreadsheetDraft: SpreadsheetEntity = {
  spreadsheetMetadataId: undefined,
  dataSource: undefined,
  filters: [],
};

export function useSpreadsheetDialog(options: UseSpreadsheetDialogOptions): {
  frameStyle: CSSProperties;
  dialogRef: RefObject<HTMLDivElement>;
  headlessProps: HeadlessMultiStepDialogProps<SpreadsheetEntity>;
} {
  const { frameStyle, dialogRef, headlessProps } = useTreeNodeDialog<SpreadsheetEntity>({
    ...options,
    nodeType: SPREADSHEET_NODE_TYPE,
    initialDraftData: defaultSpreadsheetDraft,
    buildSteps: ({ data, metadata, persistBasicInfo, updatePayload, dialogRef, mode, nodeId, parentId }) => [
      {
        id: 'basic',
        label: 'Basic Information',
        component: (
          <BasicInfoStep
            name={metadata?.name ?? ''}
            description={metadata?.description ?? ''}
            tags={metadata?.tags ?? []}
            mode={mode}
            onChange={({ name, description, tags }: BasicInfoData) =>
              persistBasicInfo({
                name,
                description: description ?? '',
                tags: tags ?? [],
              })
            }
            validate={({ name }: BasicInfoData) => (name.trim().length ? null : 'Name is required')}
          />
        ),
        validate: () => Boolean(metadata?.name?.trim()),
      },
      {
        id: 'data-source',
        label: 'Data Source',
        component: (
          <DataSourceStep
            mode={mode}
            nodeId={nodeId}
            parentId={parentId}
            data={data}
            onChange={(patch) => updatePayload(patch)}
            setValid={() => {}}
            setError={() => {}}
            disabled={false}
            dialogRef={dialogRef}
          />
        ),
        validate: () => Boolean(data?.spreadsheetMetadataId),
      },
      {
        id: 'filtering',
        label: 'Filtering',
        component: (
          <FilteringStep
            mode={mode}
            nodeId={nodeId}
            parentId={parentId}
            data={data}
            onChange={(patch) => updatePayload(patch)}
            setValid={() => {}}
            setError={() => {}}
            disabled={false}
            dialogRef={dialogRef}
          />
        ),
        validate: () => true,
      },
    ],
  });

  return { frameStyle, dialogRef, headlessProps };
}
