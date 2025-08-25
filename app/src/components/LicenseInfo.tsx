import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface LicenseData {
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

interface LicenseInfoProps {
  licenseData?: LicenseData;
}

const LICENSE_CATEGORIES = {
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
} as const;

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

export function LicenseInfo({ licenseData }: LicenseInfoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<LicenseData>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | false>('MIT');

  useEffect(() => {
    if (licenseData) {
      setPackages(licenseData);
      setLoading(false);
    } else {
      // Try to load license data dynamically
      loadLicenseData();
    }
  }, [licenseData]);

  const loadLicenseData = async () => {
    try {
      setLoading(true);
      // Try to fetch license data from a pre-generated file
      // Use base URL from environment if available
      const basePath = import.meta.env.BASE_URL || '/';
      const licensePath = `${basePath}licenses.json`.replace(/\/+/g, '/');
      const response = await fetch(licensePath).catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json();
        setPackages(data);
      } else {
        // Fallback: show a message about running license-checker
        setError('License data not available. Run "npm run analyze:licenses" to generate it.');
      }
    } catch (err) {
      console.error('Failed to load license data:', err);
      setError('Failed to load license information');
    } finally {
      setLoading(false);
    }
  };

  // Filter packages based on search query
  const filteredPackages = Object.entries(packages).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group packages by license type
  const groupedPackages = filteredPackages.reduce((acc, [name, info]) => {
    const license = info.licenses || 'UNKNOWN';
    const category = categorizeLicense(license);
    
    if (!acc[category]) {
      acc[category] = [];
    }
    
    acc[category].push({ name, ...info });
    return acc;
  }, {} as Record<string, Array<{ name: string } & LicenseData[string]>>);

  // Sort categories by safety (MIT/Apache first, GPL last)
  const sortedCategories = Object.keys(groupedPackages).sort((a, b) => {
    const order = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'CC0-1.0', 'CC-BY-4.0', 'Unlicense', 'LGPL', 'GPL', 'GPL-3.0', 'UNKNOWN'];
    return order.indexOf(a) - order.indexOf(b);
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && Object.keys(packages).length === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  const totalPackages = filteredPackages.length;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Open Source Licenses
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        This application uses {totalPackages} open source packages with the following licenses:
      </Typography>

      {/* Search field */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search packages..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* License summary */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {sortedCategories.map((category) => {
          const config = LICENSE_CATEGORIES[category as keyof typeof LICENSE_CATEGORIES];
          const count = groupedPackages[category].length;
          
          return (
            <Chip
              key={category}
              label={`${config.label} (${count})`}
              color={config.color as any}
              size="small"
              sx={{ mb: 1 }}
            />
          );
        })}
      </Stack>

      {/* Grouped license list */}
      {sortedCategories.map((category) => {
        const config = LICENSE_CATEGORIES[category as keyof typeof LICENSE_CATEGORIES];
        const categoryPackages = groupedPackages[category];
        
        return (
          <Accordion
            key={category}
            expanded={expandedCategory === category}
            onChange={(_, isExpanded) => setExpandedCategory(isExpanded ? category : false)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <Chip
                  label={config.label}
                  color={config.color as any}
                  size="small"
                />
                <Typography variant="subtitle1">
                  {categoryPackages.length} package{categoryPackages.length !== 1 ? 's' : ''}
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Package</TableCell>
                      <TableCell>License</TableCell>
                      <TableCell>Publisher</TableCell>
                      <TableCell>Repository</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryPackages.map((pkg) => (
                      <TableRow key={pkg.name}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {pkg.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={pkg.licenses || 'Unknown'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {pkg.publisher || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {pkg.repository ? (
                            <Typography
                              variant="body2"
                              component="a"
                              href={pkg.repository}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                color: 'primary.main',
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              View
                            </Typography>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}