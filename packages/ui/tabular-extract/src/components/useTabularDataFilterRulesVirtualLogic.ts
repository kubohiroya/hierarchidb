import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { TabularColumnInfo, TabularColumnType } from '@hierarchidb/tabular-store';
import type { TabularFilterOperator, TabularFilterRule } from '../types/index';

export type FilterOperatorOption = {
  value: TabularFilterOperator;
  label: string;
  types: TabularColumnType[];
};

const requiresValue = (operator: TabularFilterOperator): boolean => {
  return operator !== 'is_null' && operator !== 'is_not_null';
};

const normalizeType = (type?: TabularColumnType): TabularColumnType => type ?? 'string';

const getRuleId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rule-${Math.random().toString(36).slice(2, 10)}`;
};

const rulesEqual = (a: TabularFilterRule[], b: TabularFilterRule[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.column !== right.column ||
      left.operator !== right.operator ||
      left.value !== right.value ||
      left.enabled !== right.enabled
    ) {
      return false;
    }
  }
  return true;
};

export interface UseTabularDataFilterRulesVirtualLogicParams {
  filters: TabularFilterRule[];
  onChange: (rules: TabularFilterRule[]) => void;
  onDirty?: () => void;
  columns: TabularColumnInfo[];
  operatorOptions: FilterOperatorOption[];
  maxVisibleRows: number;
  rowHeight: number;
}

export function useTabularDataFilterRulesVirtualLogic({
  filters,
  onChange,
  onDirty,
  columns,
  operatorOptions,
  maxVisibleRows,
  rowHeight,
}: UseTabularDataFilterRulesVirtualLogicParams) {
  const notifyDirty = useCallback(() => onDirty?.(), [onDirty]);
  const firstColumnName = columns[0]?.name ?? '';
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const draftValuesRef = useRef<Record<string, string>>({});
  const normalizedRulesRef = useRef<TabularFilterRule[]>(filters);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [viewportHeight, setViewportHeight] = useState<number>(rowHeight * maxVisibleRows);
  const [scrollTop, setScrollTop] = useState(0);
  const resizingRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    draftValuesRef.current = draftValues;
  }, [draftValues]);

  const ensureRule = useCallback(
    (rule: TabularFilterRule): TabularFilterRule => {
      const columnName = rule.column && columns.some((column) => column.name === rule.column)
        ? rule.column
        : firstColumnName;
      const columnType = normalizeType(columns.find((column) => column.name === columnName)?.type);
      const availableOps = operatorOptions.filter((operator) => operator.types.includes(columnType));
      const operator = availableOps.some((option) => option.value === rule.operator)
        ? rule.operator
        : availableOps[0]?.value ?? 'equals';
      const shouldRequireValue = operator ? requiresValue(operator) : false;
      const value = rule.value ?? '';
      const enabled = shouldRequireValue ? (rule.enabled && String(value).trim().length > 0) : rule.enabled;
      return {
        ...rule,
        column: columnName,
        operator,
        value,
        enabled,
      };
    },
    [columns, firstColumnName, operatorOptions],
  );

  const normalizedRules = useMemo<TabularFilterRule[]>(() => {
    const next = filters.map(ensureRule);
    if (rulesEqual(next, normalizedRulesRef.current)) {
      return normalizedRulesRef.current;
    }
    normalizedRulesRef.current = next;
    return next;
  }, [filters, ensureRule]);

  useEffect(() => {
    normalizedRulesRef.current = normalizedRules;
  }, [normalizedRules]);

  const handleUpdateRule = useCallback(
    (id: string, updater: (current: TabularFilterRule) => TabularFilterRule) => {
      const currentRules = normalizedRulesRef.current;
      const next = currentRules.map((rule) => (rule.id === id ? ensureRule(updater(rule)) : rule));
      if (!rulesEqual(next, currentRules)) {
        onChange(next);
      }
    },
    [ensureRule, onChange],
  );

  const handleAddRule = useCallback(() => {
    const columnName = firstColumnName;
    const columnType = normalizeType(columns.find((column) => column.name === columnName)?.type);
    const availableOps = operatorOptions.filter((operator) => operator.types.includes(columnType));
    const operator = availableOps[0]?.value ?? 'equals';
    const newRule: TabularFilterRule = {
      id: getRuleId(),
      column: columnName,
      operator,
      value: '',
      enabled: false,
    };
    const next = [...normalizedRules, newRule];
    onChange(next);
  }, [columns, firstColumnName, normalizedRules, onChange, operatorOptions]);

  const handleDeleteRule = useCallback(
    (id: string) => {
      const next = normalizedRules.filter((rule) => rule.id !== id);
      if (!rulesEqual(next, normalizedRules)) {
        onChange(next);
      }
    },
    [normalizedRules, onChange],
  );

  const totalHeight = normalizedRules.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight));
  const overscan = Math.ceil(viewportHeight / rowHeight) + 6;
  const endIndex = Math.min(normalizedRules.length, startIndex + overscan);
  const visibleRules = normalizedRules.slice(startIndex, endIndex);
  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = Math.max(0, totalHeight - endIndex * rowHeight);
  const enabledCount = normalizedRules.filter((rule) => rule.enabled).length;

  const inputHeight = Math.max(32, rowHeight - 10);
  const rowCellSx = { py: 0.5, height: rowHeight };

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizingRef.current = { startY: event.clientY, startHeight: viewportHeight };
    const handleMove = (mouseEvent: globalThis.MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = mouseEvent.clientY - resizingRef.current.startY;
      const next = Math.max(rowHeight * 5, Math.min(rowHeight * 30, resizingRef.current.startHeight + delta));
      setViewportHeight(next);
    };
    const handleUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [rowHeight, viewportHeight]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect?.width) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      rulesEqual(normalizedRulesRef.current, normalizedRules)
      && Object.keys(draftValuesRef.current).length === normalizedRules.length
    ) {
      return;
    }

    setDraftValues((prev) => {
      const next: Record<string, string> = {};
      for (const rule of normalizedRules) {
        const current = prev[rule.id];
        next[rule.id] = current ?? String(rule.value ?? '');
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameLength = prevKeys.length === nextKeys.length;
      const sameEntries = sameLength
        && prevKeys.every((key) => Object.prototype.hasOwnProperty.call(next, key) && prev[key] === next[key]);
      if (sameEntries) {
        draftValuesRef.current = prev;
        return prev;
      }
      draftValuesRef.current = next;
      return next;
    });
  }, [normalizedRules]);

  return {
    notifyDirty,
    editingRowId,
    setEditingRowId,
    draftValuesRef,
    setDraftValues,
    normalizedRules,
    handleUpdateRule,
    handleAddRule,
    handleDeleteRule,
    viewportHeight,
    containerRef,
    containerWidth,
    handleScroll,
    handleResizeStart,
    inputHeight,
    rowCellSx,
    visibleRules,
    topSpacer,
    bottomSpacer,
    enabledCount,
    inputRefs,
  };
}

export { normalizeType, requiresValue };
