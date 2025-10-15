/**
 * BaseMapDialogExtension
 * - Provides step state evaluator for BaseMap steps (style, viewport, display)
 * - Steps themselves may be provided by host; evaluator aligns by stepNumber [2,3,4].
 */

import type { PeerEntity } from '@hierarchidb/common-types';
import { NodeDialogPlugin } from '@hierarchidb/plugin-api';

function isValidUrl(u: string | undefined): boolean {
  if (!u) return false;
  try { new URL(u); return true; } catch { return false; }
}

type BaseMapDialogPeer = PeerEntity<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

interface BaseMapDialogMapStyle {
  style?: string;
  customStyleUrl?: string;
}

interface BaseMapDialogViewport {
  center?: [number, number];
  zoom?: number;
}

interface BaseMapDialogData {
  mapStyle?: BaseMapDialogMapStyle;
  viewport?: BaseMapDialogViewport;
}

const asCoordinateTuple = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const [lng, lat] = value;
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : undefined;
};

const toDialogData = (value: BaseMapDialogPeer): BaseMapDialogData => {
  if (!isRecord(value)) return {};

  const rawMapStyle = value['mapStyle'];
  const mapStyle: BaseMapDialogMapStyle | undefined = isRecord(rawMapStyle)
    ? {
        style: typeof rawMapStyle['style'] === 'string' ? rawMapStyle['style'] : undefined,
        customStyleUrl:
          typeof rawMapStyle['customStyleUrl'] === 'string' ? rawMapStyle['customStyleUrl'] : undefined,
      }
    : undefined;

  const rawViewport = value['viewport'];
  const viewport: BaseMapDialogViewport | undefined = isRecord(rawViewport)
    ? {
        center: asCoordinateTuple(rawViewport['center']),
        zoom: typeof rawViewport['zoom'] === 'number' ? rawViewport['zoom'] : undefined,
      }
    : undefined;

  return { mapStyle, viewport };
};

const hasValidStyleStep = (data: BaseMapDialogData): boolean => {
  const style = data.mapStyle?.style;
  if (!style) return false;
  if (style === 'custom') {
    return isValidUrl(data.mapStyle?.customStyleUrl);
  }
  return true;
};

const hasValidViewportStep = (data: BaseMapDialogData): boolean => {
  const center = data.viewport?.center;
  if (!center) return false;
  const [lng, lat] = center;
  const zoom = data.viewport?.zoom;
  return (
    typeof lng === 'number' && lng >= -180 && lng <= 180 &&
    typeof lat === 'number' && lat >= -90 && lat <= 90 &&
    typeof zoom === 'number' && zoom >= 0 && zoom <= 24
  );
};

const resolveStepNumbers = (stepNumbers: ReadonlyArray<number> | undefined): number[] => (
  stepNumbers && stepNumbers.length > 0
    ? Array.from(stepNumbers)
    : [2, 3, 4]
);

export class BaseMapDialogExtension extends NodeDialogPlugin<BaseMapDialogPeer> {
  readonly pluginId = 'basemap-plugin-dialog-extension';
  readonly pluginName = 'BaseMap Dialog Extension';
  readonly pluginDescription = 'Adds BaseMap step evaluators to plugin dialogs';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    return {
      getValidatedSteps: (data: BaseMapDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogData(data);
        return resolveStepNumbers(stepNumbers).map((n) => {
          if (n === 2) {
            return hasValidStyleStep(dialogData);
          }
          if (n === 3) {
            return hasValidViewportStep(dialogData);
          }
          if (n === 4) {
            return true; // display options optional
          }
          return true;
        });
      },
      getEnabledSteps: (data: BaseMapDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogData(data);
        // sequential gating: 2 -> 3 -> 4
        const filled = new Map<number, boolean>();
        const ok2 = (() => {
          return hasValidStyleStep(dialogData);
        })();
        const ok3 = (() => {
          return hasValidViewportStep(dialogData);
        })();
        filled.set(2, ok2);
        filled.set(3, ok3);
        return resolveStepNumbers(stepNumbers).map((n) => {
          if (n === 2) return true;
          if (n === 3) return filled.get(2) === true;
          if (n === 4) return filled.get(3) === true;
          return true;
        });
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: BaseMapDialogPeer) => {
      const dialogData = toDialogData(data);
      // Require style step and viewport step to be valid
      if (!hasValidStyleStep(dialogData)) return false;
      return hasValidViewportStep(dialogData);
    };
  }
}

export const baseMapDialogExtension = new BaseMapDialogExtension();
export async function initializeBaseMapDialogExtension(): Promise<void> {
  await baseMapDialogExtension.initialize();
}
