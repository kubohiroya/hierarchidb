/**
 * BaseMapDialogExtension
 * - Provides step state evaluator for BaseMap steps (style, viewport, display)
 * - Steps themselves may be provided by host; evaluator aligns by stepNumber [2,3,4].
 */

import type { PeerEntity } from '@hierarchidb/common-type';
import { NodeDialogPlugin } from '@hierarchidb/plugins-base-plugin';

function isValidUrl(u: string | undefined): boolean {
  if (!u) return false;
  try { new URL(u); return true; } catch { return false; }
}

type BaseMapDialogPeer = PeerEntity<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toDialogRecord = (value: BaseMapDialogPeer): Record<string, unknown> => (
  isRecord(value) ? value : {}
);

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
        const dialogData = toDialogRecord(data) as any;
        return resolveStepNumbers(stepNumbers).map((n) => {
          if (n === 2) {
            const style = dialogData?.mapStyle?.style;
            if (!style) return false;
            if (style === 'custom') return isValidUrl(dialogData?.mapStyle?.customStyleUrl);
            return true;
          }
          if (n === 3) {
            const vp = dialogData?.viewport;
            if (!vp) return false;
            const [lng, lat] = vp.center || [];
            const zoom = vp.zoom;
            const ok = typeof lng === 'number' && lng >= -180 && lng <= 180 &&
              typeof lat === 'number' && lat >= -90 && lat <= 90 &&
              typeof zoom === 'number' && zoom >= 0 && zoom <= 24;
            return ok;
          }
          if (n === 4) {
            return true; // display options optional
          }
          return true;
        });
      },
      getEnabledSteps: (data: BaseMapDialogPeer, stepNumbers?: ReadonlyArray<number>) => {
        const dialogData = toDialogRecord(data) as any;
        // sequential gating: 2 -> 3 -> 4
        const filled = new Map<number, boolean>();
        const ok2 = (() => {
          const style = dialogData?.mapStyle?.style;
          if (!style) return false;
          if (style === 'custom') return isValidUrl(dialogData?.mapStyle?.customStyleUrl);
          return true;
        })();
        const ok3 = (() => {
          const vp = dialogData?.viewport;
          if (!vp) return false;
          const [lng, lat] = vp.center || [];
          const zoom = vp.zoom;
          return typeof lng === 'number' && lng >= -180 && lng <= 180 &&
            typeof lat === 'number' && lat >= -90 && lat <= 90 &&
            typeof zoom === 'number' && zoom >= 0 && zoom <= 24;
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
      const dialogData = toDialogRecord(data) as any;
      // Require style step and viewport step to be valid
      const style = dialogData?.mapStyle?.style;
      if (!style) return false;
      if (style === 'custom' && !isValidUrl(dialogData?.mapStyle?.customStyleUrl)) return false;

      const vp = dialogData?.viewport;
      if (!vp) return false;
      const [lng, lat] = vp.center || [];
      const zoom = vp.zoom;
      const ok = typeof lng === 'number' && lng >= -180 && lng <= 180 &&
        typeof lat === 'number' && lat >= -90 && lat <= 90 &&
        typeof zoom === 'number' && zoom >= 0 && zoom <= 24;
      return ok;
    };
  }
}

export const baseMapDialogExtension = new BaseMapDialogExtension();
export async function initializeBaseMapDialogExtension(): Promise<void> {
  await baseMapDialogExtension.initialize();
}
