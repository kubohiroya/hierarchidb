/**
 * @file useDialogUrlParams.ts
 * @description ダイアログURLパラメータ管理用フック
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseDialogUrlParams, type DialogUrlParams } from '../utils/dialogUrlParams';

/**
 * ダイアログURLパラメータ管理フックの戻り値
 */
export interface UseDialogUrlParamsReturn {
  /** 現在のパラメータ */
  params: DialogUrlParams;
  /** 初期ステップ番号 */
  initialStep?: number;
  /** 初期全画面モード */
  initialFullscreen: boolean;
  /** 地図パラメータ */
  mapParams?: DialogUrlParams['mapParams'];
  /** カスタムパラメータ取得 */
  getParam: (key: string) => string | undefined;
  /** ステップ更新 */
  updateStep: (step: number) => void;
  /** ダイアログモード更新 */
  updateDialogMode: (mode: 'normal' | 'full') => void;
  /** 地図パラメータ更新 */
  updateMapParams: (mapParams: DialogUrlParams['mapParams']) => void;
  /** カスタムパラメータ更新 */
  updateParam: (key: string, value: string | null) => void;
  /** 全パラメータクリア */
  clearParams: () => void;
}

/**
 * ダイアログURLパラメータ管理フック
 * @param options - オプション設定
 * @returns ダイアログURLパラメータ管理オブジェクト
 */
export function useDialogUrlParams(options?: {
  /** URLパラメータの自動同期を有効にするか */
  syncToUrl?: boolean;
  /** デフォルトのダイアログモード */
  defaultDialogMode?: 'normal' | 'full';
}): UseDialogUrlParamsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const syncToUrl = options?.syncToUrl ?? true;

  // URLパラメータをパース
  const params = useMemo(() => {
    return parseDialogUrlParams(searchParams);
  }, [searchParams]);

  // 初期値を決定
  const initialStep = params.step;
  const initialFullscreen =
    params.dialogMode === 'full' ||
    (params.dialogMode === undefined && options?.defaultDialogMode === 'full');

  // カスタムパラメータ取得
  const getParam = useCallback(
    (key: string): string | undefined => {
      return params.customParams[key];
    },
    [params.customParams]
  );

  // ステップ更新
  const updateStep = useCallback(
    (step: number) => {
      if (!syncToUrl) return;

      const newParams = new URLSearchParams(searchParams);
      newParams.set('step', step.toString());
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, syncToUrl]
  );

  // ダイアログモード更新
  const updateDialogMode = useCallback(
    (mode: 'normal' | 'full') => {
      if (!syncToUrl) return;

      const newParams = new URLSearchParams(searchParams);
      newParams.set('dialog', mode);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, syncToUrl]
  );

  // 地図パラメータ更新
  const updateMapParams = useCallback(
    (mapParams: DialogUrlParams['mapParams']) => {
      if (!syncToUrl || !mapParams) return;

      const newParams = new URLSearchParams(searchParams);
      const { zoom, lng, lat } = mapParams;
      newParams.set('zxy', `${zoom},${lng},${lat}`);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, syncToUrl]
  );

  // カスタムパラメータ更新
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      if (!syncToUrl) return;

      const newParams = new URLSearchParams(searchParams);
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams, syncToUrl]
  );

  // 全パラメータクリア
  const clearParams = useCallback(() => {
    if (!syncToUrl) return;

    // ダイアログ関連のパラメータのみクリア
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('step');
    newParams.delete('dialog');
    newParams.delete('zxy');

    // カスタムパラメータもクリア（必要に応じて）
    for (const key of Object.keys(params.customParams)) {
      newParams.delete(key);
    }

    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams, params.customParams, syncToUrl]);

  return {
    params,
    initialStep,
    initialFullscreen,
    mapParams: params.mapParams,
    getParam,
    updateStep,
    updateDialogMode,
    updateMapParams,
    updateParam,
    clearParams,
  };
}
