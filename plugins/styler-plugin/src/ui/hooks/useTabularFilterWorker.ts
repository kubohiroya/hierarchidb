import { useEffect, useMemo, useRef, useState } from 'react';
import type { TabularFilterRule } from '@hierarchidb/ui-tabular';
import type { StylerTableRow } from '../../common/types/StylerEntity.js';
import { applyFilters } from '../utils/tabularFilters.js';

type WorkerResponse = {
  id: number;
  rows: StylerTableRow[];
  error?: string;
};

export interface UseTabularFilterWorkerOptions {
  rows: StylerTableRow[];
  filters: TabularFilterRule[];
  limit?: number;
  debounceMs?: number;
  onResult?: (rows: StylerTableRow[]) => void;
}

export interface UseTabularFilterWorkerResult {
  filteredRows: StylerTableRow[];
  isFiltering: boolean;
  usedFallback: boolean;
  workerError: string | null;
}

const DEFAULT_LIMIT = 1000;
const DEFAULT_DEBOUNCE_MS = 220;

export const useTabularFilterWorker = ({
  rows,
  filters,
  limit = DEFAULT_LIMIT,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onResult,
}: UseTabularFilterWorkerOptions): UseTabularFilterWorkerResult => {
  const [filteredRows, setFilteredRows] = useState<StylerTableRow[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestRequestRef = useRef(0);
  const rowsRef = useRef(rows);
  const filtersRef = useRef(filters);
  const debounceTimerRef = useRef<number | null>(null);

  const supportsWorker = useMemo(() => typeof Worker !== 'undefined', []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (!supportsWorker) return undefined;
    try {
      const worker = new Worker(
        new URL('../workers/tabularFilter.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, rows: nextRows, error } = event.data ?? {};
        if (id !== latestRequestRef.current) {
          return;
        }
        if (error) {
          setWorkerError(error);
          setUsedFallback(true);
          const fallback = applyFilters(rowsRef.current ?? [], filtersRef.current ?? [], limit);
          setFilteredRows(fallback);
          onResult?.(fallback);
          setIsFiltering(false);
          return;
        }
        setWorkerError(null);
        setFilteredRows(nextRows ?? []);
        onResult?.(nextRows ?? []);
        setIsFiltering(false);
      };
      worker.addEventListener('message', handleMessage);
      return () => {
        worker.removeEventListener('message', handleMessage);
        worker.terminate();
        workerRef.current = null;
      };
    } catch (error) {
      setWorkerError(error instanceof Error ? error.message : String(error));
      setUsedFallback(true);
      setFilteredRows(applyFilters(rowsRef.current ?? [], filtersRef.current ?? [], limit));
      onResult?.(applyFilters(rowsRef.current ?? [], filtersRef.current ?? [], limit));
      setIsFiltering(false);
      return undefined;
    }
  }, [limit, onResult, supportsWorker]);

  useEffect(() => {
    if (!supportsWorker || !workerRef.current) {
      const fallback = applyFilters(rows ?? [], filters ?? [], limit);
      setFilteredRows(fallback);
      onResult?.(fallback);
      setIsFiltering(false);
      setUsedFallback(true);
      return undefined;
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    latestRequestRef.current = requestId;
    setIsFiltering(true);
    debounceTimerRef.current = window.setTimeout(() => {
      workerRef.current?.postMessage({
        id: requestId,
        rows,
        filters,
        limit,
      });
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [debounceMs, filters, limit, onResult, rows, supportsWorker]);

  return {
    filteredRows,
    isFiltering,
    usedFallback,
    workerError,
  };
};
