import type { ChipProps } from '@mui/material/Chip';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface LicenseData {
  [packageName: string]: {
    licenses?: string;
    repository?: string;
    publisher?: string;
    email?: string;
    url?: string;
    path?: string;
    licenseFile?: string;
  };
}

export const LICENSE_CATEGORIES: Record<string, { color: ChipProps['color']; label: string }> = {
  MIT: { color: 'success', label: 'MIT' },
  'Apache-2.0': { color: 'success', label: 'Apache 2.0' },
  'BSD-3-Clause': { color: 'success', label: 'BSD-3' },
  'BSD-2-Clause': { color: 'success', label: 'BSD-2' },
  ISC: { color: 'success', label: 'ISC' },
  'CC0-1.0': { color: 'info', label: 'CC0' },
  'CC-BY-4.0': { color: 'info', label: 'CC-BY' },
  Unlicense: { color: 'info', label: 'Unlicense' },
  GPL: { color: 'warning', label: 'GPL' },
  'GPL-3.0': { color: 'warning', label: 'GPL-3.0' },
  LGPL: { color: 'warning', label: 'LGPL' },
  UNKNOWN: { color: 'default', label: 'Unknown' },
};

function categorizeLicense(license: string): keyof typeof LICENSE_CATEGORIES {
  const upperLicense = license.toUpperCase();

  if (upperLicense.includes('MIT')) return 'MIT';
  if (upperLicense.includes('APACHE-2')) return 'Apache-2.0';
  if (upperLicense.includes('BSD-3')) return 'BSD-3-Clause';
  if (upperLicense.includes('BSD-2')) return 'BSD-2-Clause';
  if (upperLicense.includes('ISC')) return 'ISC';
  if (upperLicense.includes('CC0')) return 'CC0-1.0';
  if (upperLicense.includes('CC-BY')) return 'CC-BY-4.0';
  if (upperLicense.includes('UNLICENSE')) return 'Unlicense';
  if (upperLicense.includes('GPL-3')) return 'GPL-3.0';
  if (upperLicense.includes('LGPL')) return 'LGPL';
  if (upperLicense.includes('GPL')) return 'GPL';

  return 'UNKNOWN';
}

export function useLicenseInfo(licenseData?: LicenseData) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<LicenseData>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | false>('MIT');

  const loadLicenseData = useCallback(async () => {
    try {
      setLoading(true);
      const basePath = import.meta.env.BASE_URL || '/';
      const licensePath = `${basePath}licenses.json`.replace(/\/+/g, '/');
      const response = await fetch(licensePath).catch(() => null);

      if (response?.ok) {
        const data = await response.json();
        setPackages(data);
      } else {
        setError('License data not available. Run "npm run analyze:licenses" to generate it.');
      }
    } catch (err) {
      console.error('Failed to load license data:', err);
      setError('Failed to load license information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (licenseData) {
      setPackages(licenseData);
      setLoading(false);
    } else {
      loadLicenseData();
    }
  }, [licenseData, loadLicenseData]);

  const filteredPackages = useMemo(
    () =>
      Object.entries(packages).filter(([name]) =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [packages, searchQuery]
  );

  const groupedPackages = useMemo(
    () =>
      filteredPackages.reduce(
        (acc, [name, info]) => {
          const license = info.licenses || 'UNKNOWN';
          const category = categorizeLicense(license);

          const entries = acc[category] ?? [];
          entries.push({ name, ...info });
          acc[category] = entries;
          return acc;
        },
        {} as Record<string, Array<{ name: string } & LicenseData[string]>>
      ),
    [filteredPackages]
  );

  const sortedCategories = useMemo(() => {
    const order = [
      'MIT',
      'Apache-2.0',
      'BSD-3-Clause',
      'BSD-2-Clause',
      'ISC',
      'CC0-1.0',
      'CC-BY-4.0',
      'Unlicense',
      'LGPL',
      'GPL',
      'GPL-3.0',
      'UNKNOWN',
    ];
    return Object.keys(groupedPackages).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [groupedPackages]);

  return {
    error,
    expandedCategory,
    filteredPackages,
    groupedPackages,
    loading,
    searchQuery,
    sortedCategories,
    totalPackages: filteredPackages.length,
    setExpandedCategory,
    setSearchQuery,
  };
}
