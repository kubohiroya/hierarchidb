import { useEffect } from 'react';

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
  useEffect(() => {
    if (!metadataEnabled) {
      setMatchedIds([]);
      return;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      setMatchedIds([]);
      return;
    }
    const matches = rows
      .filter((row) => buildSearchText(row).toLowerCase().includes(keyword))
      .map((row) => getRowId(row));
    setMatchedIds(matches);
  }, [buildSearchText, getRowId, metadataEnabled, rows, searchKeyword, setMatchedIds]);
};
