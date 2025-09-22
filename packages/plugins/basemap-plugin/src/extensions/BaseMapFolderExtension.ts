/**
 * BaseMapFolderExtension
 * - Provides step state evaluator for BaseMap steps (style, viewport, display)
 * - Steps themselves may be provided by host; evaluator aligns by stepNumber [2,3,4].
 */

import { BaseFolderPlugin } from '@hierarchidb/plugins-folder-plugin';

function isValidUrl(u: string | undefined): boolean {
  if (!u) return false;
  try { new URL(u); return true; } catch { return false; }
}

export class BaseMapFolderExtension extends BaseFolderPlugin {
  readonly pluginId = 'basemap-plugin-folder-extension';
  readonly pluginName = 'BaseMap (Folder Extension)';
  readonly pluginDescription = 'Adds BaseMap step evaluators to folder dialog';
  readonly pluginVersion = '1.0.0';

  protected getStepStateEvaluator() {
    return {
      getFilledSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        return nums.map((n) => {
          if (n === 2) {
            const style = data?.mapStyle?.style;
            if (!style) return false;
            if (style === 'custom') return isValidUrl(data?.mapStyle?.customStyleUrl);
            return true;
          }
          if (n === 3) {
            const vp = data?.viewport;
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
      getNavigableSteps: (data: any, stepNumbers?: number[]) => {
        const nums = stepNumbers || [];
        // sequential gating: 2 -> 3 -> 4
        const filled = new Map<number, boolean>();
        const ok2 = (() => {
          const style = data?.mapStyle?.style;
          if (!style) return false;
          if (style === 'custom') return isValidUrl(data?.mapStyle?.customStyleUrl);
          return true;
        })();
        const ok3 = (() => {
          const vp = data?.viewport;
          if (!vp) return false;
          const [lng, lat] = vp.center || [];
          const zoom = vp.zoom;
          return typeof lng === 'number' && lng >= -180 && lng <= 180 &&
            typeof lat === 'number' && lat >= -90 && lat <= 90 &&
            typeof zoom === 'number' && zoom >= 0 && zoom <= 24;
        })();
        filled.set(2, ok2);
        filled.set(3, ok3);
        return nums.map((n) => {
          if (n === 2) return true;
          if (n === 3) return filled.get(2) === true;
          if (n === 4) return filled.get(3) === true;
          return true;
        });
      },
    };
  }

  protected getSubmitEligibility() {
    return (data: any) => {
      // Require style step and viewport step to be valid
      const style = data?.mapStyle?.style;
      if (!style) return false;
      if (style === 'custom' && !isValidUrl(data?.mapStyle?.customStyleUrl)) return false;

      const vp = data?.viewport;
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

export const baseMapFolderExtension = new BaseMapFolderExtension();
export async function initializeBaseMapFolderExtension() { await baseMapFolderExtension.initialize(); }
