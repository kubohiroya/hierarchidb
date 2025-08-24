/**
 * @fileoverview Hook for managing country matrix selections
 * @module @hierarchidb/ui-country-select/hooks
 */

import { useState, useCallback, useMemo } from 'react';
import type { MatrixSelection, MatrixColumn } from '../types/MatrixColumn';

export interface UseCountrySelectionOptions {
  /** Initial selections */
  initialSelections?: MatrixSelection[];
  /** Available columns for validation */
  columns?: MatrixColumn[];
  /** Minimum required selections */
  minSelections?: number;
}

export interface UseCountrySelectionResult {
  /** Current selections */
  selections: MatrixSelection[];
  /** Set selections */
  setSelections: (selections: MatrixSelection[]) => void;
  /** Update selection for a specific country and column */
  updateSelection: (countryCode: string, columnId: string, selected: boolean) => void;
  /** Select all for specific countries */
  selectAllForCountries: (countryCodes: string[], columnIds: string[]) => void;
  /** Clear all selections */
  clearAll: () => void;
  /** Clear selections for specific countries */
  clearForCountries: (countryCodes: string[]) => void;
  /** Selection statistics */
  stats: {
    totalCountries: number;
    totalSelections: number;
    isValid: boolean;
    selectedCountries: string[];
  };
  /** Whether a specific selection is active */
  isSelected: (countryCode: string, columnId: string) => boolean;
  /** Get selections for a specific country */
  getCountrySelections: (countryCode: string) => Record<string, boolean>;
}

/**
 * Hook for managing country matrix selections with utilities
 */
export function useCountrySelection({
  initialSelections = [],

  minSelections = 1,
}: UseCountrySelectionOptions = {}): UseCountrySelectionResult {
  const [selections, setSelections] = useState<MatrixSelection[]>(initialSelections);

  // Update a specific selection
  const updateSelection = useCallback((countryCode: string, columnId: string, selected: boolean) => {
    setSelections(prev => {
      const newSelections = [...prev];
      const existingIndex = newSelections.findIndex(s => s.countryCode === countryCode);
      
      if (existingIndex >= 0) {
        const existing = newSelections[existingIndex];
        if (existing) {
          newSelections[existingIndex] = {
            countryCode: existing.countryCode,
            selections: {
              ...existing.selections,
              [columnId]: selected,
            },
          };
        }
      } else if (selected) {
        newSelections.push({
          countryCode,
          selections: { [columnId]: selected },
        });
      }

      return newSelections;
    });
  }, []);

  // Select all for specific countries and columns
  const selectAllForCountries = useCallback((countryCodes: string[], columnIds: string[]) => {
    setSelections(prev => {
      const newSelections = [...prev];
      
      countryCodes.forEach(countryCode => {
        const existingIndex = newSelections.findIndex(s => s.countryCode === countryCode);
        const selections = columnIds.reduce((acc, columnId) => {
          acc[columnId] = true;
          return acc;
        }, {} as Record<string, boolean>);
        
        if (existingIndex >= 0) {
          const existing = newSelections[existingIndex];
          if (existing) {
            newSelections[existingIndex] = {
              countryCode: existing.countryCode,
              selections: {
                ...existing.selections,
                ...selections,
              },
            };
          }
        } else {
          newSelections.push({ countryCode, selections });
        }
      });

      return newSelections;
    });
  }, []);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelections([]);
  }, []);

  // Clear selections for specific countries
  const clearForCountries = useCallback((countryCodes: string[]) => {
    setSelections(prev => prev.filter(s => !countryCodes.includes(s.countryCode)));
  }, []);

  // Check if a specific selection is active
  const isSelected = useCallback((countryCode: string, columnId: string) => {
    const countrySelection = selections.find(s => s.countryCode === countryCode);
    return countrySelection?.selections[columnId] || false;
  }, [selections]);

  // Get selections for a specific country
  const getCountrySelections = useCallback((countryCode: string) => {
    const countrySelection = selections.find(s => s.countryCode === countryCode);
    return countrySelection?.selections || {};
  }, [selections]);

  // Calculate statistics
  const stats = useMemo(() => {
    const selectedCountries = selections
      .filter(s => Object.values(s.selections).some(Boolean))
      .map(s => s.countryCode);
    
    const totalSelections = selections.reduce((sum, selection) => {
      return sum + Object.values(selection.selections).filter(Boolean).length;
    }, 0);

    return {
      totalCountries: selectedCountries.length,
      totalSelections,
      isValid: selectedCountries.length >= minSelections,
      selectedCountries,
    };
  }, [selections, minSelections]);

  return {
    selections,
    setSelections,
    updateSelection,
    selectAllForCountries,
    clearAll,
    clearForCountries,
    stats,
    isSelected,
    getCountrySelections,
  };
}