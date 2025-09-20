import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export interface UseTreeTableSelectAllOptions {
  pageNodeId?: string;
}

export interface UseTreeTableSelectAllResult {
  selectAll: boolean;
  selectAllHydrated: boolean;
  setSelectAll: Dispatch<SetStateAction<boolean>>;
}

export function useTreeTableSelectAll({ pageNodeId }: UseTreeTableSelectAllOptions): UseTreeTableSelectAllResult {
  const [selectAll, setSelectAll] = useState(false);
  const [selectAllHydrated, setSelectAllHydrated] = useState<boolean>(!pageNodeId);

  useEffect(() => {
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
        const { getSelectAll } = await import('../../state/properties-db.js');
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
  }, [pageNodeId]);

  useEffect(() => {
    if (!pageNodeId || !selectAllHydrated) return;
    (async () => {
      const { saveSelectAll } = await import('../../state/properties-db.js');
      await saveSelectAll(pageNodeId, selectAll);
    })();
  }, [selectAll, pageNodeId, selectAllHydrated]);

  return { selectAll, selectAllHydrated, setSelectAll };
}
