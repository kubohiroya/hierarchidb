import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export interface UseTreeTableSelectAllOptions {
  pageNodeId?: string;
  /**
   * 'page' (default) persists select-all atoms per pageNodeId.
   * 'session' keeps the toggle in-memory only and always boots as false.
   */
  persistence?: 'page' | 'session';
}

export interface UseTreeTableSelectAllResult {
  selectAll: boolean;
  selectAllHydrated: boolean;
  setSelectAll: Dispatch<SetStateAction<boolean>>;
}

export function useTreeTableSelectAll({
  pageNodeId,
  persistence = 'page',
}: UseTreeTableSelectAllOptions): UseTreeTableSelectAllResult {
  const [selectAll, setSelectAll] = useState(false);
  const [selectAllHydrated, setSelectAllHydrated] = useState<boolean>(
    persistence !== 'page' || !pageNodeId
  );

  useEffect(() => {
    if (persistence !== 'page') {
      setSelectAll(false);
      setSelectAllHydrated(true);
      return;
    }

    if (!pageNodeId) {
      setSelectAll(false);
      setSelectAllHydrated(true);
      return;
    }

    let cancelled = false;
    setSelectAll(false);
    setSelectAllHydrated(false);

    (async () => {
      try {
        const { getSelectAll } = await import('~/state/properties-db');
        const saved = await getSelectAll(pageNodeId);
        if (!cancelled) {
          setSelectAll(saved ?? false);
        }
      } catch {
        if (!cancelled) {
          setSelectAll(false);
        }
      } finally {
        if (!cancelled) {
          setSelectAllHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNodeId, persistence]);

  useEffect(() => {
    if (persistence !== 'page') return;
    if (!pageNodeId || !selectAllHydrated) return;
    (async () => {
      const { saveSelectAll } = await import('~/state/properties-db');
      await saveSelectAll(pageNodeId, selectAll);
    })();
  }, [selectAll, pageNodeId, selectAllHydrated, persistence]);

  return { selectAll, selectAllHydrated, setSelectAll };
}
