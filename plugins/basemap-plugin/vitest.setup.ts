/**
 * basemap Test Setup
 * Uses base vitest setup configuration
 */

// Import base setup (includes _obsolate_common mocks and utilities)
import '../../vitest.setup.base';
import React from 'react';
import { vi } from 'vitest';

vi.mock('@hierarchidb/ui-map', () => {
  return {
    loadMapLibreMap: async () => ({
      MapLibreMap: () => React.createElement('div', { 'data-testid': 'mock-maplibre-map' }),
    }),
  };
});
vi.mock('@hierarchidb/ui-i18n', () => {
  return {
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      changeLanguage: async () => {},
      i18n: undefined,
      ready: true,
    }),
  };
});

// Package-specific setup can be added here if needed
