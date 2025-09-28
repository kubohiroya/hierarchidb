/**
 * InMemoryDataProvider
 *
 * A simple in-memory implementation of the DataProvider interface.
 * Useful for small datasets, testing, and demos.
 */

import type {
  DataChangeEvent,
  DataItem,
  DataProvider,
  FilterParams,
  QueryParams,
  QueryResult,
} from '../types/DataProvider.js';

export class InMemoryDataProvider<T extends DataItem = DataItem> implements DataProvider<T> {
  private data: T[];
  private subscribers: Set<(event: DataChangeEvent<T>) => void> = new Set();

  constructor(initialData: T[] = []) {
    this.data = [...initialData];
  }

  async query(params: QueryParams): Promise<QueryResult<T>> {
    let result = [...this.data];

    // Apply search
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((value) => String(value).toLowerCase().includes(searchLower)),
      );
    }

    // Apply filters
    if (params.filters) {
      for (const filter of params.filters) {
        result = result.filter((item) => this.applyFilter(item, filter));
      }
    }

    // Apply sorting
    if (params.sort && params.sort.length > 0) {
      result.sort((a, b) => {
        for (const sort of params.sort!) {
          const aVal = this.readField(a, sort.field);
          const bVal = this.readField(b, sort.field);

          const comparison = this.compareValues(aVal, bVal);
          if (comparison === 0) continue;

          return sort.direction === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    const total = result.length;

    // Apply pagination
    if (params.pagination) {
      const { page, pageSize } = params.pagination;
      const start = page * pageSize;
      result = result.slice(start, start + pageSize);
    }

    // Apply field selection
    if (params.fields && params.fields.length > 0) {
      result = result.map((item) => this.pickFields(item, params.fields!));
    }

    return {
      data: result,
      total,
      page: params.pagination?.page || 0,
      pageSize: params.pagination?.pageSize || result.length,
    };
  }

  async getById(id: string | number): Promise<T | null> {
    return this.data.find((item) => item.id === id) || null;
  }

  async getByIds(ids: (string | number)[]): Promise<T[]> {
    const idSet = new Set(ids);
    return this.data.filter((item) => idSet.has(item.id));
  }

  async count(filters?: FilterParams[]): Promise<number> {
    if (!filters || filters.length === 0) {
      return this.data.length;
    }

    let result = [...this.data];
    for (const filter of filters) {
      result = result.filter((item) => this.applyFilter(item, filter));
    }
    return result.length;
  }

  async export(format: 'csv' | 'json' | 'excel', params?: QueryParams): Promise<Blob> {
    const result = await this.query(params || {});

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        });

      case 'csv':
        return new Blob([this.toCSV(result.data)], {
          type: 'text/csv',
        });

      case 'excel':
        // For Excel, we'd need a library like xlsx
        // For now, return CSV with Excel mime type
        return new Blob([this.toCSV(result.data)], {
          type: 'application/vnd.ms-excel',
        });

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  subscribe(callback: (event: DataChangeEvent<T>) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Helper methods for data manipulation
  async create(item: T): Promise<T> {
    this.data.push(item);
    this.notifySubscribers({
      type: 'created',
      items: [item],
      timestamp: Date.now(),
    });
    return item;
  }

  async update(id: string | number, updates: Partial<T>): Promise<T | null> {
    const index = this.data.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = { ...this.data[index], ...updates, id } as T;
    this.data[index] = updated;

    this.notifySubscribers({
      type: 'updated',
      items: [updated],
      timestamp: Date.now(),
    });

    return updated;
  }

  async delete(id: string | number): Promise<boolean> {
    const index = this.data.findIndex((item) => item.id === id);
    if (index === -1) return false;

    const deleted = this.data.splice(index, 1);

    this.notifySubscribers({
      type: 'deleted',
      items: deleted,
      timestamp: Date.now(),
    });

    return true;
  }

  // Private helper methods
  private applyFilter(item: T, filter: FilterParams): boolean {
    const value = this.readField(item, filter.field);
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'equals':
        return value === filterValue;

      case 'contains':
        return this.toSearchString(value).includes(this.toSearchString(filterValue));

      case 'startsWith':
        return this.toSearchString(value).startsWith(this.toSearchString(filterValue));

      case 'endsWith':
        return this.toSearchString(value).endsWith(this.toSearchString(filterValue));

      case 'gt':
        return this.compareNumbers(value, filterValue, (left, right) => left > right);

      case 'gte':
        return this.compareNumbers(value, filterValue, (left, right) => left >= right);

      case 'lt':
        return this.compareNumbers(value, filterValue, (left, right) => left < right);

      case 'lte':
        return this.compareNumbers(value, filterValue, (left, right) => left <= right);

      case 'between': {
        if (!Array.isArray(filterValue) || filterValue.length < 2) return false;
        const [min, max] = filterValue;
        return this.compareNumbers(value, min, (left, right) => left >= right) &&
          this.compareNumbers(value, max, (left, right) => left <= right);
      }

      case 'in':
        return Array.isArray(filterValue) && filterValue.some((candidate) => candidate === value);

      default:
        return true;
    }
  }

  private toCSV(data: T[]): string {
    if (data.length === 0 || !data[0]) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((item) =>
      headers
        .map((header) => {
          const value = this.readField(item, header);
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value || '');
          return stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private notifySubscribers(event: DataChangeEvent<T>): void {
    this.subscribers.forEach((callback) => callback(event));
  }

  private readField(item: T, field: string): unknown {
    const record = item as Record<string, unknown>;
    return  Object.hasOwn(record, field) ? record[field] : undefined;
  }

  private compareValues(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return a < b ? -1 : 1;
    }

    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }

    return this.toComparableString(a).localeCompare(this.toComparableString(b));
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }

  private toComparableString(value: unknown): string {
    if (value == null) return '';
    return String(value);
  }

  private toSearchString(value: unknown): string {
    return this.toComparableString(value).toLowerCase();
  }

  private compareNumbers(
    leftValue: unknown,
    rightValue: unknown,
    comparator: (left: number, right: number) => boolean,
  ): boolean {
    const left = this.toNumber(leftValue);
    const right = this.toNumber(rightValue);
    if (Number.isNaN(left) || Number.isNaN(right)) {
      return false;
    }
    return comparator(left, right);
  }

  private pickFields(item: T, fields: string[]): T {
    if (fields.length === 0) {
      return { ...item };
    }

    const allowed = new Set([...fields, 'id']);
    const clone = { ...item } as T;
    const record = clone as Record<string, unknown>;

    Object.keys(record).forEach((key) => {
      if (!allowed.has(key)) {
        delete record[key];
      }
    });

    return clone;
  }
}
