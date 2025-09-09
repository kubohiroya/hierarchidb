/**
  * @file dialogUrlParams.ts
 * @description URL
  */

/**
  * URL
  */
export interface DialogUrlParams {
  /**
      */
  step?: number;
  /**
      */
  dialogMode?: 'normal' | 'full';
  /**
      */
  mapParams?: {
    zoom: number;
    lng: number;
    lat: number;
  };
  /**
      */
  customParams: Record<string, string>;
}

/**
  * ZXY
 * @param zxyString - "zoom,lng,lat"
 * @returns
  */
function parseZxyParam(zxyString: string): DialogUrlParams['mapParams'] | undefined {
  if (!zxyString) return undefined;

  const parts = zxyString.split(',');
  if (parts.length !== 3) return undefined;

  const zoom = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  const lat = parseFloat(parts[2]);

  if (isNaN(zoom) || isNaN(lng) || isNaN(lat)) return undefined;

  return { zoom, lng, lat };
}

/**
  * URLSearchParams
 * @param searchParams - URLSearchParams
 * @returns
  */
export function parseDialogUrlParams(searchParams: URLSearchParams): DialogUrlParams {
  const result: DialogUrlParams = {
    customParams: {},
  };

  for (const [key, value] of searchParams.entries()) {
    switch (key) {
      case 'step': {
        const stepNum = parseInt(value, 10);
        if (!isNaN(stepNum) && stepNum > 0) {
          result.step = stepNum;
        }
        break;
      }

      case 'dialog': {
        if (value === 'full' || value === 'normal') {
          result.dialogMode = value;
        }
        break;
      }

      case 'zxy': {
        const mapParams = parseZxyParam(value);
        if (mapParams) {
          result.mapParams = mapParams;
        }
        break;
      }

      default:
        //  customParams
        result.customParams[key] = value;
        break;
    }
  }

  return result;
}

/**
  * URLSearchParams
 * @param params -
 * @returns URLSearchParams
  */
export function dialogParamsToUrlSearchParams(params: DialogUrlParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.step !== undefined) {
    searchParams.set('step', params.step.toString());
  }

  if (params.dialogMode) {
    searchParams.set('dialog', params.dialogMode);
  }

  if (params.mapParams) {
    const { zoom, lng, lat } = params.mapParams;
    searchParams.set('zxy', `${zoom},${lng},${lat}`);
  }

  for (const [key, value] of Object.entries(params.customParams)) {
    searchParams.set(key, value);
  }

  return searchParams;
}

/**
  * URL
 * @returns
  */
export function getDialogUrlParams(): DialogUrlParams {
  if (typeof window === 'undefined') {
    return { customParams: {} };
  }

  const searchParams = new URLSearchParams(window.location.search);
  return parseDialogUrlParams(searchParams);
}

/**
  * URL
 * @param params -
  */
export function updateDialogUrlParams(params: Partial<DialogUrlParams>): void {
  if (typeof window === 'undefined') return;

  const currentParams = getDialogUrlParams();
  const updatedParams: DialogUrlParams = {
    ...currentParams,
    ...params,
    customParams: {
      ...currentParams.customParams,
      ...(params.customParams || {}),
    },
  };

  const searchParams = dialogParamsToUrlSearchParams(updatedParams);
  const newUrl = `${window.location.pathname}?${searchParams.toString()}`;

  window.history.replaceState(null, '', newUrl);
}