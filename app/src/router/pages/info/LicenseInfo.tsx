import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import { LICENSE_CATEGORIES, type LicenseData, useLicenseInfo } from './useLicenseInfo.js';

interface LicenseInfoProps {
  licenseData?: LicenseData;
}

export function LicenseInfo({ licenseData }: LicenseInfoProps) {
  const {
    error,
    expandedCategory,
    filteredPackages,
    groupedPackages,
    loading,
    searchQuery,
    sortedCategories,
    totalPackages,
    setExpandedCategory,
    setSearchQuery,
  } = useLicenseInfo(licenseData);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && filteredPackages.length === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

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
          const config = LICENSE_CATEGORIES[category as keyof typeof LICENSE_CATEGORIES] || {
            color: 'default' as ChipProps['color'],
            label: category,
          };
          const count = groupedPackages[category]?.length || 0;

          return (
            <Chip
              key={category}
              label={`${config.label} (${count})`}
              color={config.color}
              size="small"
              sx={{ mb: 1 }}
            />
          );
        })}
      </Stack>

      {/* Grouped license list */}
      {sortedCategories.map((category) => {
        const config = LICENSE_CATEGORIES[category as keyof typeof LICENSE_CATEGORIES] || {
          color: 'default' as ChipProps['color'],
          label: category,
        };
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
                <Chip label={config.label} color={config.color} size="small" />
                <Typography variant="subtitle1">
                  {categoryPackages?.length || 0} package
                  {(categoryPackages?.length || 0) !== 1 ? 's' : ''}
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
                    {(categoryPackages || []).map((pkg) => (
                      <TableRow key={pkg.name}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {pkg.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={pkg.licenses || 'Unknown'} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{pkg.publisher || '-'}</Typography>
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
