/**
 * Abstract Data Provider Interface
 * 
 * Defines a generic contract for data sources that can be displayed in the data grid.
 * This abstraction allows the grid to work with any data source (database, API, file, etc.)
 * without knowing the specific implementation details.
 */

/**
 * Base data item interface
 * All data items must have a unique identifier
 */
export interface DataItem {
  /** Unique identifier for the data item */
  id: string | number;
  /** Optional timestamp for when the item was created */
  createdAt?: number | string | Date;
  /** Optional timestamp for when the item was last updated */
  updatedAt?: number | string | Date;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Current page (0-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Filter parameters
 */
export interface FilterParams {
  /** Field to filter by */
  field: string;
  /** Filter operator */
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in';
  /** Filter value(s) */
  value: any;
}

/**
 * Query parameters for fetching data
 */
export interface QueryParams {
  /** Pagination parameters */
  pagination?: PaginationParams;
  /** Sort parameters */
  sort?: SortParams[];
  /** Filter parameters */
  filters?: FilterParams[];
  /** Global search term */
  search?: string;
  /** Fields to include in the response */
  fields?: string[];
}

/**
 * Query result with data and metadata
 */
export interface QueryResult<T extends DataItem = DataItem> {
  /** Data items */
  data: T[];
  /** Total number of items (for pagination) */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Abstract data provider interface
 * Implementations can be database queries, API calls, file reads, etc.
 */
export interface DataProvider<T extends DataItem = DataItem> {
  /**
   * Fetch data based on query parameters
   */
  query(params: QueryParams): Promise<QueryResult<T>>;
  
  /**
   * Get a single item by ID
   */
  getById(id: string | number): Promise<T | null>;
  
  /**
   * Get multiple items by IDs
   */
  getByIds(ids: (string | number)[]): Promise<T[]>;
  
  /**
   * Get the total count of items
   */
  count(filters?: FilterParams[]): Promise<number>;
  
  /**
   * Export data in a specific format
   */
  export?(format: 'csv' | 'json' | 'excel', params?: QueryParams): Promise<Blob>;
  
  /**
   * Subscribe to real-time updates (optional)
   */
  subscribe?(callback: (event: DataChangeEvent<T>) => void): () => void;
}

/**
 * Data change event for real-time updates
 */
export interface DataChangeEvent<T extends DataItem = DataItem> {
  /** Type of change */
  type: 'created' | 'updated' | 'deleted';
  /** Affected item(s) */
  items: T[];
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * Column definition for the data grid
 */
export interface ColumnDefinition<T extends DataItem = DataItem> {
  /** Field name in the data item */
  field: keyof T | string;
  /** Display header */
  header: string;
  /** Column type for formatting */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'custom';
  /** Width configuration */
  width?: number | string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Enable sorting */
  sortable?: boolean;
  /** Enable filtering */
  filterable?: boolean;
  /** Custom formatter */
  formatter?: (value: any, item: T) => React.ReactNode;
  /** Aggregation function for summaries */
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count' | ((items: T[]) => any);
  /** Column visibility */
  visible?: boolean;
  /** Column is pinned */
  pinned?: 'left' | 'right';
}

/**
 * Schema definition for automatic column generation
 */
export interface SchemaDefinition {
  /** Field definitions */
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
      label?: string;
      required?: boolean;
      description?: string;
      enum?: any[];
      format?: string; // e.g., 'email', 'url', 'uuid'
    };
  };
  /** Primary key field */
  primaryKey?: string;
  /** Display name field */
  displayField?: string;
  /** Indexes for optimization hints */
  indexes?: string[];
}