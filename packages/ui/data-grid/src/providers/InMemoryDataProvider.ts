/**
 * InMemoryDataProvider
 * 
 * A simple in-memory implementation of the DataProvider interface.
 * Useful for small datasets, testing, and demos.
 */

import type {
  DataProvider,
  DataItem,
  QueryParams,
  QueryResult,
  FilterParams,
  DataChangeEvent,
} from '../types/DataProvider';

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
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply filters
    if (params.filters) {
      for (const filter of params.filters) {
        result = result.filter(item => this.applyFilter(item, filter));
      }
    }

    // Apply sorting
    if (params.sort && params.sort.length > 0) {
      result.sort((a, b) => {
        for (const sort of params.sort!) {
          const aVal = (a as any)[sort.field];
          const bVal = (b as any)[sort.field];
          
          if (aVal === bVal) continue;
          
          const comparison = aVal < bVal ? -1 : 1;
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
      result = result.map(item => {
        const filtered: any = { id: item.id };
        for (const field of params.fields!) {
          if (field in item) {
            filtered[field] = (item as any)[field];
          }
        }
        return filtered;
      });
    }

    return {
      data: result,
      total,
      page: params.pagination?.page || 0,
      pageSize: params.pagination?.pageSize || result.length,
    };
  }

  async getById(id: string | number): Promise<T | null> {
    return this.data.find(item => item.id === id) || null;
  }

  async getByIds(ids: (string | number)[]): Promise<T[]> {
    const idSet = new Set(ids);
    return this.data.filter(item => idSet.has(item.id));
  }

  async count(filters?: FilterParams[]): Promise<number> {
    if (!filters || filters.length === 0) {
      return this.data.length;
    }

    let result = [...this.data];
    for (const filter of filters) {
      result = result.filter(item => this.applyFilter(item, filter));
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
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return null;

    const updated = { ...this.data[index], ...updates, id };
    this.data[index] = updated;
    
    this.notifySubscribers({
      type: 'updated',
      items: [updated],
      timestamp: Date.now(),
    });
    
    return updated;
  }

  async delete(id: string | number): Promise<boolean> {
    const index = this.data.findIndex(item => item.id === id);
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
    const value = (item as any)[filter.field];
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'equals':
        return value === filterValue;
      
      case 'contains':
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
      
      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
      
      case 'gt':
        return value > filterValue;
      
      case 'gte':
        return value >= filterValue;
      
      case 'lt':
        return value < filterValue;
      
      case 'lte':
        return value <= filterValue;
      
      case 'between':
        return value >= filterValue[0] && value <= filterValue[1];
      
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      
      default:
        return true;
    }
  }

  private toCSV(data: T[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(item =>
      headers.map(header => {
        const value = (item as any)[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value || '');
        return stringValue.includes(',') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private notifySubscribers(event: DataChangeEvent<T>): void {
    this.subscribers.forEach(callback => callback(event));
  }
}