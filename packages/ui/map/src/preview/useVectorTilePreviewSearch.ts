import { useEffect, useRef } from 'react';

type SearchTextBuilder<Row> = (row: Row) => string;
type RowIdGetter<Row> = (row: Row) => string;

export const useVectorTilePreviewSearch = <Row,>(
  metadataEnabled: boolean,
  rows: Row[],
  searchKeyword: string,
  getRowId: RowIdGetter<Row>,
  buildSearchText: SearchTextBuilder<Row>,
  setMatchedIds: (ids: string[]) => void,
) => {
  const lastMatchedRef = useRef<string[]>([]);

  useEffect(() => {
    const setIfChanged = (next: string[]) => {
      const prev = lastMatchedRef.current;
      if (prev.length === next.length && prev.every((value, index) => value === next[index])) {
        return;
      }
      lastMatchedRef.current = next;
      setMatchedIds(next);
    };

    if (!metadataEnabled) {
      setIfChanged([]);
      return;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      setIfChanged([]);
      return;
    }
    const matches = rows
      .filter((row) => {
        const haystack = buildSearchText(row).toLowerCase();
        return haystack
          .split(/\s+/)
          .some((token) => token.startsWith(keyword));
      })
      .map((row) => getRowId(row));
    setIfChanged(matches);
  }, [buildSearchText, getRowId, metadataEnabled, rows, searchKeyword, setMatchedIds]);
};
