import { describe, expect, it, vi } from 'vitest';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { BaseMapWorkingCopy } from '../../../common/types/BaseMapEntity.js';
const { getBasemapStepConfigs } = await import('../basemapStepConfigs.js');

const configs = getBasemapStepConfigs();
const mapStyleStep = configs.find((cfg) => cfg.id === 'map-style');
const viewportStep = configs.find((cfg) => cfg.id === 'viewport');

if (!mapStyleStep || !viewportStep) {
  throw new Error('Basemap map-style/viewport steps are not registered');
}
const mapStyleValidate = mapStyleStep.validate;
const viewportValidate = viewportStep.validate;

if (!mapStyleValidate || !viewportValidate) {
  throw new Error('Basemap steps must define validate functions');
}

const noopSetValid: StepComponentProps<BaseMapWorkingCopy>['setValid'] = () => undefined;
const noopSetError: StepComponentProps<BaseMapWorkingCopy>['setError'] = () => undefined;

describe('basemap step provider validation', () => {
  it('requires the map style step to be touched before validation passes', () => {
    expect(
      mapStyleValidate({
        draft: { mapStyle: { style: 'streets' } },
        uiState: { mapStyleTouched: false },
      } as BaseMapWorkingCopy)
    ).toBe(false);

    expect(
      mapStyleValidate({
        draft: { mapStyle: { style: 'streets' } },
        uiState: { mapStyleTouched: true },
      } as BaseMapWorkingCopy)
    ).toBe(true);
  });

  it('requires the viewport step to wait for a valid map style selection', () => {
    const baseViewport = {
      center: [0, 0] as [number, number],
      zoom: 5,
      bearing: 0,
      pitch: 0,
    };

    expect(
      viewportValidate({
        draft: {
          mapStyle: { style: 'streets' },
          viewport: baseViewport,
        },
        uiState: { mapStyleTouched: false },
      } as BaseMapWorkingCopy)
    ).toBe(false);

    expect(
      viewportValidate({
        draft: {
          mapStyle: { style: 'streets' },
          viewport: baseViewport,
        },
        uiState: { mapStyleTouched: true },
      } as BaseMapWorkingCopy)
    ).toBe(true);
  });

  it('prefers persisted map style when draft is missing', () => {
    const persistedStyle = { style: 'dark' as const };
    const mapStyleNode = mapStyleStep.componentFactory({
      mode: 'edit',
      nodeId: 'node-1',
      parentId: 'parent-1',
      data: {
        draft: {},
        mapStyle: persistedStyle,
        viewport: {
          center: [0, 0],
          zoom: 1,
          bearing: 0,
          pitch: 0,
        },
      } as BaseMapWorkingCopy,
      onChange: vi.fn(),
      setValid: noopSetValid,
      setError: noopSetError,
    });
    expect(mapStyleNode).toBeTruthy();
    expect((mapStyleNode as { props: { value?: { style?: string } } }).props.value?.style).toBe(
      'dark'
    );
  });

  it('prefers persisted viewport when draft is missing', () => {
    const persistedViewport = {
      center: [10, 20] as [number, number],
      zoom: 9,
      bearing: 15,
      pitch: 0,
    };
    const viewportNode = viewportStep.componentFactory({
      mode: 'edit',
      nodeId: 'node-1',
      parentId: 'parent-1',
      data: {
        draft: {},
        mapStyle: { style: 'streets' },
        viewport: persistedViewport,
      } as BaseMapWorkingCopy,
      onChange: vi.fn(),
      setValid: noopSetValid,
      setError: noopSetError,
    });
    const props = viewportNode as {
      props: { value?: typeof persistedViewport; mapStyle?: { style?: string } };
    };
    expect(props.props.value).toEqual(persistedViewport);
    expect(props.props.mapStyle?.style).toBe('streets');
  });
  it('leaves map style unselected in create mode when no draft is provided', () => {
    const onChange = vi.fn();
    const node = mapStyleStep.componentFactory({
      mode: 'create',
      nodeId: 'node-1',
      parentId: 'parent-1',
      data: undefined,
      onChange,
      setValid: noopSetValid,
      setError: noopSetError,
    });
    expect((node as { props: { value?: unknown } }).props.value).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the provided default viewport in create mode when no value exists', () => {
    const node = viewportStep.componentFactory({
      mode: 'create',
      nodeId: 'node-1',
      parentId: 'parent-1',
      data: undefined,
      onChange: vi.fn(),
      setValid: noopSetValid,
      setError: noopSetError,
    });
    const props = node as { props: { value?: { center?: [number, number]; zoom?: number } } };
    expect(props.props.value?.center).toEqual([139.767, 35.681]);
    expect(props.props.value?.zoom).toBe(10);
  });
});
