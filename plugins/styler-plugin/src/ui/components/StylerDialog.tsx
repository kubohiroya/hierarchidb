import { useMemo, useRef } from 'react';
import type { NodeId, TreeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import type { StylerDialogData } from './types.js';
import { StyleSettingsStep } from './steps/StyleSettingsStep.js';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import {
  DataSourceStep as SpreadsheetDataSourceStep,
  FilteringStep as SpreadsheetFilteringStep,
} from '@hierarchidb/spreadsheet-plugin';

export interface StylerDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave: (data: StylerDialogData) => Promise<void>;
}

export const StylerDialog: React.FC<StylerDialogProps> = ({
  open,
  mode,
  nodeId,
  parentId,
  treeId,
  onClose,
  onSave,
}) => {
  const latestDataRef = useRef<StylerDialogData>({} as StylerDialogData);

  const onSaveHandler = useMemo(
    () => async (_meta: TreeNodeMetadata, savedId?: NodeId) => {
      const payload = { ...(latestDataRef.current ?? {}) } as StylerDialogData;
      const resolvedId = savedId ?? payload.nodeId;
      latestDataRef.current = payload;
      await onSave({ ...payload, nodeId: resolvedId } as StylerDialogData);
    },
    [onSave]
  );

  const {
    frameStyle,
    headlessProps,
    data,
  } = useTreeNodeDialog<StylerDialogData>({
    open,
    mode,
    nodeType: 'styler',
    nodeId,
    parentId,
    treeId,
    onClose,
    onSave: onSaveHandler,
    initialDraftMetadata: { name: '', description: '', tags: [] },
    initialDraftData: {},
    buildSteps: ({ data, metadata, persistBasicInfo, updatePayload }) => {
      const handlePersistBasic = (value: BasicInfoData) =>
        persistBasicInfo({
          name: value.name,
          description: value.description,
          tags: value.tags ?? [],
        });

      const handleUpdate = (patch: Partial<StylerDialogData>) => {
        updatePayload({ ...(data ?? {}), ...patch });
      };

      return [
        {
          id: 'basic',
          label: 'Basic Information',
          component: (
            <BasicInfoStep
              name={metadata?.name ?? ''}
              description={metadata?.description ?? ''}
              tags={metadata?.tags ?? []}
              mode={mode}
              onChange={handlePersistBasic}
              validate={({ name }: BasicInfoData) => (name.trim().length ? null : 'Name is required')}
            />
          ),
          validate: () => Boolean((metadata?.name ?? '').trim()),
        },
        {
          id: 'style-settings',
          label: 'Style Settings',
          component: (
            <StyleSettingsStep
              mode={mode}
              nodeId={nodeId}
              parentId={parentId}
              data={data}
              onChange={handleUpdate}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
            />
          ),
          validate: () => Boolean(data.styleSettings?.styleType),
        },
        {
          id: 'data-source',
          label: 'Data Source',
          component: (
            <SpreadsheetDataSourceStep
              mode={mode}
              nodeId={nodeId}
              parentId={parentId}
              data={data}
              onChange={(next) => {
                handleUpdate({
                  ...(next as StylerDialogData),
                  spreadsheetMetadata: (next as StylerDialogData).metadata ?? undefined,
                });
              }}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
            />
          ),
          validate: () => Boolean(data.spreadsheetMetadataId),
        },
        {
          id: 'filtering',
          label: 'Filtering',
          component: (
            <SpreadsheetFilteringStep
              mode={mode}
              nodeId={nodeId}
              parentId={parentId}
              data={data}
              onChange={(next) => {
                handleUpdate({
                  ...(next as StylerDialogData),
                  spreadsheetMetadata: (next as StylerDialogData).metadata ?? undefined,
                });
              }}
              setValid={() => {}}
              setError={() => {}}
              disabled={false}
            />
          ),
          validate: () => true,
        },
        {
          id: 'style-mapping',
          label: 'Style Mapping',
          component: <StylerStep5 data={data} onChange={handleUpdate} onValidate={() => {}} />,
          validate: () => Boolean(data.styleSettings),
        },
        {
          id: 'preview',
          label: 'Preview & Save',
          component: <StylerStep6 data={data} onChange={handleUpdate} />,
          validate: () => Boolean(data.styleSettings),
        },
      ];
    },
  });

  latestDataRef.current = (data as StylerDialogData) ?? latestDataRef.current;

  return (
    <div style={frameStyle} role="dialog" aria-modal={open}>
      <HeadlessMultiStepDialog {...headlessProps} />
    </div>
  );
};
