import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type VirtualizedTextLogRow =
  | {
      readonly kind: 'log';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly sequence: number;
      readonly timestamp: string;
      readonly stream: 'stdout' | 'stderr' | 'system';
      readonly text: string;
    }
  | {
      readonly kind: 'gap';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly reason: 'reconnected';
    }
  | {
      readonly kind: 'limit';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly reason: 'LOG_BUFFER_LIMIT_REACHED';
    };

export type VirtualizedTextLogDialogProps = {
  open: boolean;
  rows: readonly VirtualizedTextLogRow[];
  onClose: () => void;
  title?: string;
  selectedRowId?: string;
  onSelectedRowChange?: (row: VirtualizedTextLogRow) => void;
  viewportHeight?: number;
  rowHeight?: number;
};

type SearchMatch = {
  rowIndex: number;
  start: number;
  end: number;
};

const DEFAULT_ROW_HEIGHT = 28;
const DEFAULT_VIEWPORT_HEIGHT = 520;

const getRowText = (row: VirtualizedTextLogRow): string => {
  switch (row.kind) {
    case 'log':
      return row.text;
    case 'gap':
      return 'Connection resumed. Logs emitted while disconnected are unavailable.';
    case 'limit':
      return 'Log buffer limit reached. Additional output is not captured.';
  }
};

const createSearchMatches = (
  rows: readonly VirtualizedTextLogRow[],
  query: string
): SearchMatch[] => {
  if (query.length === 0) return [];
  const needle = query.toLocaleLowerCase();
  const matches: SearchMatch[] = [];
  rows.forEach((row, rowIndex) => {
    const haystack = getRowText(row).toLocaleLowerCase();
    let offset = haystack.indexOf(needle);
    while (offset >= 0) {
      matches.push({ rowIndex, start: offset, end: offset + query.length });
      offset = haystack.indexOf(needle, offset + Math.max(1, query.length));
    }
  });
  return matches;
};

const renderHighlightedText = (
  text: string,
  matches: readonly SearchMatch[],
  rowIndex: number,
  currentMatch: SearchMatch | undefined
): React.ReactNode => {
  const rowMatches = matches.filter((match) => match.rowIndex === rowIndex);
  if (rowMatches.length === 0) return text;
  const segments: React.ReactNode[] = [];
  let cursor = 0;
  rowMatches.forEach((match, index) => {
    if (cursor < match.start) {
      segments.push(text.slice(cursor, match.start));
    }
    const isCurrent =
      currentMatch?.rowIndex === match.rowIndex &&
      currentMatch.start === match.start &&
      currentMatch.end === match.end;
    segments.push(
      <Box
        component="mark"
        key={`${match.start}:${match.end}:${index}`}
        data-current-match={isCurrent ? 'true' : undefined}
        sx={{
          bgcolor: isCurrent ? 'warning.main' : 'warning.light',
          color: isCurrent ? 'warning.contrastText' : 'text.primary',
          px: 0.25,
          borderRadius: 0.5,
        }}
      >
        {text.slice(match.start, match.end)}
      </Box>
    );
    cursor = match.end;
  });
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }
  return segments;
};

const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

export const VirtualizedTextLogDialog: React.FC<VirtualizedTextLogDialogProps> = ({
  open,
  rows,
  onClose,
  title = 'Task log',
  selectedRowId,
  onSelectedRowChange,
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  rowHeight = DEFAULT_ROW_HEIGHT,
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [tailSuspended, setTailSuspended] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [internalSelectedRowId, setInternalSelectedRowId] = useState<string | null>(null);
  const effectiveSelectedRowId = selectedRowId ?? internalSelectedRowId;
  const selectedRowIndex = useMemo(
    () =>
      effectiveSelectedRowId ? rows.findIndex((row) => row.rowId === effectiveSelectedRowId) : -1,
    [effectiveSelectedRowId, rows]
  );
  const selectedRowIsHistorical = selectedRowIndex >= 0 && selectedRowIndex < rows.length - 1;
  const matches = useMemo(() => createSearchMatches(rows, query), [query, rows]);
  const currentMatch = matches[currentMatchIndex];
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: rows.length,
    estimateSize: () => rowHeight,
    getScrollElement: () => parentRef.current,
    initialRect: { width: 1, height: viewportHeight },
    observeElementRect: (_instance, callback) => {
      const element = parentRef.current;
      callback({
        width: element?.clientWidth ?? 1,
        height: element?.clientHeight || viewportHeight,
      });
      return () => {};
    },
    observeElementOffset: (_instance, callback) => {
      const element = parentRef.current;
      if (!element) {
        callback(0, false);
        return () => {};
      }
      const handleOffset = () => callback(element.scrollTop, false);
      handleOffset();
      element.addEventListener('scroll', handleOffset, { passive: true });
      return () => {
        element.removeEventListener('scroll', handleOffset);
      };
    },
    overscan: 8,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (focusedRowIndex === null) return indexes;
      return Array.from(new Set([...indexes, focusedRowIndex])).sort((a, b) => a - b);
    },
    scrollToFn: (offset) => {
      const element = parentRef.current;
      if (!element) return;
      Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        value: offset,
        writable: true,
      });
      element.dispatchEvent(new Event('scroll'));
    },
  });

  const selectRow = useCallback(
    (row: VirtualizedTextLogRow) => {
      setInternalSelectedRowId(row.rowId);
      onSelectedRowChange?.(row);
    },
    [onSelectedRowChange]
  );

  const scrollToRow = useCallback(
    (rowIndex: number, align: 'center' | 'end' = 'center') => {
      setFocusedRowIndex(rowIndex);
      window.requestAnimationFrame(() => virtualizer.scrollToIndex(rowIndex, { align }));
    },
    [virtualizer]
  );

  const jumpToMatch = useCallback(
    (nextIndex: number) => {
      if (matches.length === 0) return;
      const resolvedIndex = modulo(nextIndex, matches.length);
      const match = matches[resolvedIndex];
      if (!match) return;
      setCurrentMatchIndex(resolvedIndex);
      const row = rows[match.rowIndex];
      if (row) selectRow(row);
      scrollToRow(match.rowIndex);
    },
    [matches, rows, scrollToRow, selectRow]
  );

  const jumpToTail = useCallback(() => {
    if (rows.length === 0) return;
    setTailSuspended(false);
    const rowIndex = rows.length - 1;
    const row = rows[rowIndex];
    if (row) selectRow(row);
    scrollToRow(rowIndex, 'end');
  }, [rows, scrollToRow, selectRow]);

  useEffect(() => {
    setCurrentMatchIndex(0);
    if (matches[0]) {
      scrollToRow(matches[0].rowIndex);
    }
  }, [matches, scrollToRow]);

  useEffect(() => {
    if (!open || tailSuspended || selectedRowIsHistorical || rows.length === 0) return;
    scrollToRow(rows.length - 1, 'end');
  }, [open, rows.length, scrollToRow, selectedRowIsHistorical, tailSuspended]);

  const handleScroll = useCallback(() => {
    const element = parentRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setTailSuspended(distanceFromBottom > rowHeight);
  }, [rowHeight]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography component="span" variant="h6" flex={1}>
            {title}
          </Typography>
          <TextField
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            slotProps={{
              htmlInput: {
                'aria-label': 'Search log',
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 280 }}
          />
          <Typography variant="body2" color="text.secondary" minWidth={64} textAlign="right">
            {matches.length === 0 ? '0/0' : `${currentMatchIndex + 1}/${matches.length}`}
          </Typography>
          <Tooltip title="Previous match">
            <span>
              <IconButton
                aria-label="Previous match"
                size="small"
                disabled={matches.length === 0}
                onClick={() => jumpToMatch(currentMatchIndex - 1)}
              >
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next match">
            <span>
              <IconButton
                aria-label="Next match"
                size="small"
                disabled={matches.length === 0}
                onClick={() => jumpToMatch(currentMatchIndex + 1)}
              >
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton aria-label="Close log" size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        <Box
          ref={parentRef}
          onScroll={handleScroll}
          role="list"
          aria-label="Task log rows"
          sx={{
            height: viewportHeight,
            overflow: 'auto',
            bgcolor: 'grey.950',
            color: 'grey.100',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 12,
            lineHeight: `${rowHeight}px`,
          }}
        >
          <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const selected = effectiveSelectedRowId === row.rowId;
              const text = getRowText(row);
              return (
                <Box
                  key={row.rowId}
                  role="listitem"
                  data-testid="log-row"
                  data-row-kind={row.kind}
                  data-row-ordinal={row.ordinal}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => selectRow(row)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: virtualRow.size,
                    display: 'grid',
                    gridTemplateColumns: '84px 76px 1fr',
                    gap: 1,
                    px: 1.5,
                    bgcolor: selected ? 'rgba(144, 202, 249, 0.20)' : 'transparent',
                    borderLeft: selected ? '3px solid' : '3px solid transparent',
                    borderLeftColor: selected ? 'primary.light' : 'transparent',
                    whiteSpace: 'pre',
                    cursor: 'default',
                  }}
                >
                  <Box component="span" color="grey.500">
                    {row.ordinal}
                  </Box>
                  <Box
                    component="span"
                    color={
                      row.kind === 'gap'
                        ? 'info.light'
                        : row.kind === 'limit'
                          ? 'warning.light'
                          : row.stream === 'stderr'
                            ? 'error.light'
                            : 'grey.400'
                    }
                  >
                    {row.kind === 'log' ? row.stream : row.kind.toUpperCase()}
                  </Box>
                  <Box component="span" overflow="hidden" textOverflow="clip">
                    {renderHighlightedText(text, matches, virtualRow.index, currentMatch)}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
        {(tailSuspended || selectedRowIsHistorical) && rows.length > 0 ? (
          <Button
            variant="contained"
            size="small"
            onClick={jumpToTail}
            startIcon={<KeyboardArrowDownIcon />}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 16,
              transform: 'translateX(-50%)',
            }}
          >
            Tail
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
