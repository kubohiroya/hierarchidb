import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { composeStepConfigs } from '@hierarchidb/plugin-base';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDialogSteps } from '~/headless/usePluginDialogController/steps';

const composedConfigs = {
  hasHostBase: false,
  configs: [],
} as unknown as ReturnType<typeof composeStepConfigs>;

const defaultMetadata: TreeNodeMetadata = { name: '', description: '', tags: [] };

describe('useDialogSteps BasicInfo focus', () => {
  it('keeps the BasicInfo component stable and propagates updated metadata', () => {
    const dialogRef = { current: null } as React.RefObject<HTMLDivElement>;
    const noopSetBasicInfo = (() => {}) as React.Dispatch<React.SetStateAction<TreeNodeMetadata>>;
    const noopSetDraftData = (() => {}) as React.Dispatch<
      React.SetStateAction<Record<string, unknown>>
    >;

    const { result, rerender } = renderHook(
      ({ basicInfo }) =>
        useDialogSteps({
          composedConfigs,
          basicInfo,
          setBasicInfo: noopSetBasicInfo,
          basicInfoMeta: { error: null, hasConflict: false },
          basicInfoValidationError: null,
          isBasicInfoValid: true,
          tagSuggestions: [],
          mode: 'create',
          nodeId: 'node-1' as NodeId,
          pageNodeId: 'parent-1' as NodeId,
          draftData: {},
          setDraftData: noopSetDraftData,
          handleBasicInfoBridge: noopSetBasicInfo,
          dialogRef,
        }),
      { initialProps: { basicInfo: defaultMetadata } }
    );

    const initialComponent = result.current.stepDescriptors[0]?.component;
    expect(result.current.currentStepData).toMatchObject({ name: '', description: '' });

    const nextMetadata: TreeNodeMetadata = { name: 'Folder', description: 'Desc', tags: [] };
    rerender({ basicInfo: nextMetadata });

    const nextComponent = result.current.stepDescriptors[0]?.component;
    expect(nextComponent).toBe(initialComponent);
    expect(result.current.currentStepData).toMatchObject({ name: 'Folder', description: 'Desc' });
  });

  it('keeps plugin step components stable across updates', () => {
    const dialogRef = { current: null } as React.RefObject<HTMLDivElement>;
    const composed = {
      hasHostBase: true,
      configs: [
        {
          id: 'custom',
          label: 'Custom',
          componentFactory: () => <div data-testid="custom-step">Custom</div>,
        },
      ],
    } as unknown as ReturnType<typeof composeStepConfigs>;

    const { result, rerender } = renderHook(
      ({ data }) =>
        useDialogSteps({
          composedConfigs: composed,
          basicInfo: defaultMetadata,
          setBasicInfo: () => {},
          basicInfoMeta: { error: null, hasConflict: false },
          basicInfoValidationError: null,
          isBasicInfoValid: true,
          tagSuggestions: [],
          mode: 'create',
          nodeId: 'node-1' as NodeId,
          pageNodeId: 'parent-1' as NodeId,
          draftData: data,
          setDraftData: () => {},
          handleBasicInfoBridge: () => {},
          dialogRef,
        }),
      { initialProps: { data: { foo: 'bar' } } }
    );

    const initialComponent = result.current.stepDescriptors[0]?.component;
    expect(initialComponent).toBeDefined();

    rerender({ data: { foo: 'baz' } });

    const nextComponent = result.current.stepDescriptors[0]?.component;
    expect(nextComponent).toBe(initialComponent);
  });
});
