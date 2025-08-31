import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { MapHighlightState, MapHighlightStyles } from '../types/index.js';
import { MapHighlightService } from '~/services/MapHighlightService.js';

interface UseMapHighlightProps {
  mapInstance?: any; // MapLibre GL JSインスタンス
  initialStyles?: Partial<MapHighlightStyles>;
  onStateChange?: (state: MapHighlightState) => void;
}

interface UseMapHighlightReturn {
  highlightState: MapHighlightState;
  setSearchMatched: (nodeIds: NodeId[]) => void;
  setSelected: (nodeIds: NodeId[]) => void;
  addSearchMatched: (nodeId: NodeId) => void;
  addSelected: (nodeId: NodeId) => void;
  removeSearchMatched: (nodeId: NodeId) => void;
  removeSelected: (nodeId: NodeId) => void;
  clearAll: () => void;
  clearSearchMatched: () => void;
  clearSelected: () => void;
  updateStyles: (styles: Partial<MapHighlightStyles>) => void;
  service: MapHighlightService;
}

export const useMapHighlight = ({
  mapInstance,
  initialStyles,
  onStateChange,
}: UseMapHighlightProps): UseMapHighlightReturn => {
  const serviceRef = useRef<MapHighlightService>();
  const [highlightState, setHighlightState] = useState<MapHighlightState>({
    searchMatched: new Set(),
    selected: new Set(),
  });

  // サービスの初期化
  if (!serviceRef.current) {
    serviceRef.current = new MapHighlightService(initialStyles, mapInstance);
    serviceRef.current.setOnStateChange((state) => {
      setHighlightState(state);
      if (onStateChange) {
        onStateChange(state);
      }
    });
  }

  // マップインスタンスが変更された場合の処理
  useEffect(() => {
    if (mapInstance && serviceRef.current) {
      serviceRef.current.setMapInstance(mapInstance);
    }
  }, [mapInstance]);

  // 検索マッチした要素を設定
  const setSearchMatched = useCallback((nodeIds: NodeId[]) => {
    serviceRef.current?.setSearchMatched(nodeIds);
  }, []);

  // 選択された要素を設定
  const setSelected = useCallback((nodeIds: NodeId[]) => {
    serviceRef.current?.setSelected(nodeIds);
  }, []);

  // 検索マッチに追加
  const addSearchMatched = useCallback((nodeId: NodeId) => {
    serviceRef.current?.addSearchMatched(nodeId);
  }, []);

  // 選択に追加
  const addSelected = useCallback((nodeId: NodeId) => {
    serviceRef.current?.addSelected(nodeId);
  }, []);

  // 検索マッチから削除
  const removeSearchMatched = useCallback((nodeId: NodeId) => {
    serviceRef.current?.removeSearchMatched(nodeId);
  }, []);

  // 選択から削除
  const removeSelected = useCallback((nodeId: NodeId) => {
    serviceRef.current?.removeSelected(nodeId);
  }, []);

  // 全てクリア
  const clearAll = useCallback(() => {
    serviceRef.current?.clearAll();
  }, []);

  // 検索マッチのみクリア
  const clearSearchMatched = useCallback(() => {
    serviceRef.current?.clearSearchMatched();
  }, []);

  // 選択のみクリア
  const clearSelected = useCallback(() => {
    serviceRef.current?.clearSelected();
  }, []);

  // スタイル更新
  const updateStyles = useCallback((styles: Partial<MapHighlightStyles>) => {
    serviceRef.current?.updateStyles(styles);
  }, []);

  return {
    highlightState,
    setSearchMatched,
    setSelected,
    addSearchMatched,
    addSelected,
    removeSearchMatched,
    removeSelected,
    clearAll,
    clearSearchMatched,
    clearSelected,
    updateStyles,
    service: serviceRef.current,
  };
};
