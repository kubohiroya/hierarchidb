import { Fragment, memo, useState, useMemo } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { Clear as ClearIcon } from '@mui/icons-material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

export interface LicenseData {
  licenses: string;
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  licenseFile?: string;
}

export interface LicenseRecord {
  [packageName: string]: LicenseData;
}

type OrderDirection = 'asc' | 'desc';
type OrderBy = 'name' | 'licenses';

export interface LicenseInfoProps {
  /**
   * License data to display
   */
  licenseData: LicenseRecord;
  /**
   * Title for the license section
   */
  title?: string;
  /**
   * Description text for the license section
   */
  description?: string;
  /**
   * Search placeholder text
   */
  searchPlaceholder?: string;
  /**
   * Custom function to determine license chip color
   */
  getLicenseColor?: (license: string) => 'success' | 'info' | 'warning' | 'default';
  /**
   * Whether to show the search bar
   */
  showSearch?: boolean;
  /**
   * Whether to show the count of packages
   */
  showCount?: boolean;
  /**
   * Initial sort order
   */
  initialOrderBy?: OrderBy;
  /**
   * Initial sort direction
   */
  initialOrderDirection?: OrderDirection;
}

const defaultGetLicenseColor = (license: string): 'success' | 'info' | 'warning' | 'default' => {
  const lowerLicense = license.toLowerCase();
  if (
    lowerLicense.includes('mit') ||
    lowerLicense.includes('apache') ||
    lowerLicense.includes('bsd') ||
    lowerLicense.includes('isc') ||
    lowerLicense.includes('0bsd')
  ) {
    return 'success';
  }
  if (lowerLicense.includes('gpl') || lowerLicense.includes('lgpl')) {
    return 'info';
  }
  if (lowerLicense.includes('commercial') || lowerLicense.includes('proprietary')) {
    return 'warning';
  }
  return 'default';
};

/**
 * A generic component for displaying open source license information
 * in a sortable, searchable table format.
 */
export const LicenseInfo = memo(function LicenseInfo({
  licenseData,
  title = 'Open Source Licenses',
  description = 'This application is built using various open-source libraries and containers. Please review the license information below for details on the licenses of the included libraries.',
  searchPlaceholder = 'Search packages...',
  getLicenseColor = defaultGetLicenseColor,
  showSearch = true,
  showCount = true,
  initialOrderBy = 'name',
  initialOrderDirection = 'asc',
}: LicenseInfoProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [orderBy, setOrderBy] = useState<OrderBy>(initialOrderBy);
  const [orderDirection, setOrderDirection] = useState<OrderDirection>(initialOrderDirection);

  const handleSort = (property: OrderBy) => {
    const isAsc = orderBy === property && orderDirection === 'asc';
    setOrderDirection(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const toggleRowExpansion = (packageName: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(packageName)) {
      newExpanded.delete(packageName);
    } else {
      newExpanded.add(packageName);
    }
    setExpandedRows(newExpanded);
  };

  const filteredData = useMemo(() => {
    const entries = Object.entries(licenseData).filter(([packageName]) =>
      packageName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    entries.sort((a, b) => {
      let aValue: string, bValue: string;

      if (orderBy === 'name') {
        aValue = a[0];
        bValue = b[0];
      } else {
        aValue = a[1].licenses || '';
        bValue = b[1].licenses || '';
      }

      if (orderDirection === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return entries;
  }, [licenseData, searchTerm, orderBy, orderDirection]);

  const parsePackageName = (packageName: string) => {
    // Handle scoped packages like @mui/material@5.0.0
    if (packageName.startsWith('@')) {
      const lastAtIndex = packageName.lastIndexOf('@');
      if (lastAtIndex > 0) {
        return {
          name: packageName.substring(0, lastAtIndex),
          version: packageName.substring(lastAtIndex + 1),
        };
      }
    }
    // Handle regular packages like react@18.0.0
    const parts = packageName.split('@');
    return {
      name: parts[0] || packageName,
      version: parts[1] || '',
    };
  };

  /*
            InputProps={{
          }}

   */
  return (
    <Box sx={{ flex: 1, width: '100%' }}>
      {title && (
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body1" color="text.secondary" paragraph>
          {description}
        </Typography>
      )}

      {showSearch && (
        <TextField
          fullWidth
          variant="outlined"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton onClick={() => setSearchTerm('')} edge="end" size="small">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      {showCount && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Found {filteredData.length} packages
        </Typography>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? orderDirection : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Package Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'licenses'}
                  direction={orderBy === 'licenses' ? orderDirection : 'asc'}
                  onClick={() => handleSort('licenses')}
                >
                  License
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map(([packageName, data]) => {
              const isExpanded = expandedRows.has(packageName);
              const { name, version } = parsePackageName(packageName);

              return (
                <Fragment key={packageName}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleRowExpansion(packageName)}
                        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                      >
                        {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {name}
                      </Typography>
                      {version && (
                        <Typography variant="caption" color="text.secondary">
                          v{version}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={data.licenses}
                        size="small"
                        color={getLicenseColor(data.licenses)}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2 }}>
                          {data.repository && (
                            <Typography variant="body2" gutterBottom>
                              <strong>Repository:</strong>{' '}
                              <Link
                                href={data.repository}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {data.repository}
                              </Link>
                            </Typography>
                          )}
                          {data.publisher && (
                            <Typography variant="body2" gutterBottom>
                              <strong>Publisher:</strong> {data.publisher}
                            </Typography>
                          )}
                          {data.email && (
                            <Typography variant="body2" gutterBottom>
                              <strong>Email:</strong> {data.email}
                            </Typography>
                          )}
                          {data.url && (
                            <Typography variant="body2" gutterBottom>
                              <strong>URL:</strong>{' '}
                              <Link href={data.url} target="_blank" rel="noopener noreferrer">
                                {data.url}
                              </Link>
                            </Typography>
                          )}
                          {data.licenseFile && (
                            <Typography variant="body2" gutterBottom>
                              <strong>License File:</strong> {data.licenseFile}
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});
