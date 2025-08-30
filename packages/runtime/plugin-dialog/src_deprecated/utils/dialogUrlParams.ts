/**
 * @file dialogUrlParams.ts
 * @description ダイアログ用URLパラメータ解析ユーティリティ
 */

/**
 * ダイアログURLパラメータ
 */
export interface DialogUrlParams {
  /** 初期表示ステップ番号 */
  step?: number;
  /** ダイアログ表示モード */
  dialogMode?: 'normal' | 'full';
  /** 地図表示用パラメータ */
  mapParams?: {
    zoom: number;
    lng: number;
    lat: number;
  };
  /** その他のカスタムパラメータ */
  customParams: Record<string, string>;
}

/**
 * ZXY形式のパラメータをパース
 * @param zxyString - "zoom,lng,lat" 形式の文字列
 * @returns パースされた地図パラメータ
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
 * URLSearchParamsからダイアログパラメータを解析
 * @param searchParams - URLSearchParamsオブジェクト
 * @returns 解析されたダイアログパラメータ
 */
export function parseDialogUrlParams(searchParams: URLSearchParams): DialogUrlParams {
  const result: DialogUrlParams = {
    customParams: {},
  };
  
  // 各パラメータを処理
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
        // その他のパラメータは customParams に格納
        result.customParams[key] = value;
        break;
    }
  }
  
  return result;
}

/**
 * ダイアログパラメータをURLSearchParamsに変換
 * @param params - ダイアログパラメータ
 * @returns URLSearchParamsオブジェクト
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
  
  // カスタムパラメータを追加
  for (const [key, value] of Object.entries(params.customParams)) {
    searchParams.set(key, value);
  }
  
  return searchParams;
}

/**
 * 現在のURLからダイアログパラメータを取得
 * @returns 解析されたダイアログパラメータ
 */
export function getDialogUrlParams(): DialogUrlParams {
  if (typeof window === 'undefined') {
    return { customParams: {} };
  }
  
  const searchParams = new URLSearchParams(window.location.search);
  return parseDialogUrlParams(searchParams);
}

/**
 * ダイアログパラメータでURLを更新（履歴を変更しない）
 * @param params - 更新するパラメータ
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