import { describe, expect, it, vi } from 'vitest';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { BaseMapDraft } from '../../../common/types/BaseMapEntity.js';
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

const noopSetValid: StepComponentProps<BaseMapDraft>['setValid'] = () => undefined;
const noopSetError: StepComponentProps<BaseMapDraft>['setError'] = () => undefined;

describe('basemap step provider validation', () => {
  it('treats any defined map style as valid (touch state no longer required)', () => {
    expect(
      mapStyleValidate({
        mapStyle: { style: 'streets' },
        uiState: { mapStyleTouched: false },
      } as BaseMapDraft)
    ).toBe(true);

    expect(
      mapStyleValidate({
        mapStyle: { style: 'streets' },
        uiState: { mapStyleTouched: true },
      } as BaseMapDraft)
    ).toBe(true);
  });

  it('treats persisted map style as valid even if untouched', () => {
    expect(
      mapStyleValidate({
        mapStyle: { style: 'streets' },
        draft: {},
        uiState: { mapStyleTouched: false },
      } as BaseMapDraft)
    ).toBe(true);
  });

  it('requires a map style and a valid viewport', () => {
    const baseViewport = {
      center: [0, 0] as [number, number],
      zoom: 5,
      bearing: 0,
      pitch: 0,
    };

    expect(
      viewportValidate({
        mapStyle: { style: 'streets' },
        viewport: baseViewport,
        uiState: { mapStyleTouched: false },
      } as BaseMapDraft)
    ).toBe(true);

    expect(
      viewportValidate({
        mapStyle: { style: 'streets' },
        viewport: baseViewport,
        uiState: { mapStyleTouched: true },
      } as BaseMapDraft)
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
      } as BaseMapDraft,
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
      } as BaseMapDraft,
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
    expect((node as { props: { value?: { style?: string } } }).props.value?.style).toBe('streets');
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

  it('treats persisted viewport as valid without manual touch', () => {
    expect(
      viewportValidate({
        mapStyle: { style: 'streets' },
        viewport: {
          center: [1, 2],
          zoom: 9,
          bearing: 0,
          pitch: 0,
        },
        uiState: {
          mapStyleTouched: false,
          viewportTouched: false,
        },
      } as BaseMapDraft)
    ).toBe(true);
  });
});
