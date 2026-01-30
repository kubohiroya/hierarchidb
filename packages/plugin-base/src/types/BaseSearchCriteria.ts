/**
 * Base search criteria interface
 */
export interface BaseSearchCriteria {
  name?: string;
  createdAfter?: number;
  createdBefore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
}
