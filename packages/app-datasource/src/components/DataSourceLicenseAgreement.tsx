/**
 * @fileoverview DataSourceLicenseAgreement - Reusable license agreement component
 * @module @hierarchidb/ui-datasource/components
 */

import React, { useCallback } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Typography,
  Stack,
  Link,
  Chip,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { 
  DataSourceName, 
  DataSourceConfig, 
  DataSourceConfigs,
  getLicenseColor 
} from '../types/DataSource';

export interface DataSourceLicenseAgreementProps {
  /**
   * Data source for license agreement
   */
  dataSourceName: DataSourceName;
  
  /**
   * Whether license has been agreed to
   */
  licenseAgreement: boolean;
  
  /**
   * Timestamp when license was agreed to (optional)
   */
  licenseAgreedAt?: string;
  
  /**
   * Callback when license agreement status changes
   */
  onLicenseAgreementChange: (agreed: boolean, timestamp?: string) => void;
  
  /**
   * Custom agreement text (optional)
   */
  agreementText?: string;
  
  /**
   * Show additional license details
   */
  showDetails?: {
    attribution?: boolean;
    limitations?: boolean;
    website?: boolean;
  };
}

/**
 * Reusable license agreement component
 * Used in Shape, Location, and Route plugins
 */
export const DataSourceLicenseAgreement: React.FC<DataSourceLicenseAgreementProps> = ({
  dataSourceName,
  licenseAgreement,
  licenseAgreedAt,
  onLicenseAgreementChange,
  agreementText,
  showDetails = {
    attribution: true,
    limitations: true,
    website: true,
  },
}) => {
  const dataSource = DataSourceConfigs[dataSourceName];

  const handleLicenseAgreement = useCallback(() => {
    const timestamp = new Date().toISOString();
    onLicenseAgreementChange(true, timestamp);
  }, [onLicenseAgreementChange]);

  const handleOpenLicensePage = useCallback(() => {
    // Open license page and mark as agreed
    window.open(dataSource.licenseUrl, '_blank', 'noopener,noreferrer');
    handleLicenseAgreement();
  }, [dataSource.licenseUrl, handleLicenseAgreement]);

  if (!dataSource) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        <Typography>Unknown data source: {dataSourceName}</Typography>
      </Alert>
    );
  }

  const licenseColor = getLicenseColor(dataSource.licenseType);
  const alertSeverity = licenseAgreement ? 'success' : 
    dataSource.licenseType === 'academic' ? 'warning' :
    dataSource.licenseType === 'commercial' ? 'error' : 'info';

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        License Agreement
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {agreementText || `Please review and agree to the licensing requirements for ${dataSource.displayName}.`}
      </Typography>

      <Alert severity={alertSeverity} sx={{ mb: 2 }}>
        <AlertTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {dataSource.displayName}
            <Chip 
              label={dataSource.license} 
              size="small" 
              color={licenseColor}
              variant="outlined"
            />
          </Stack>
        </AlertTitle>
        
        <Stack spacing={2}>
          <Typography variant="body2">
            {dataSource.description}
          </Typography>
          
          {showDetails.attribution && (
            <Box>
              <Typography variant="body2">
                <strong>Attribution:</strong> {dataSource.attribution}
              </Typography>
            </Box>
          )}

          {showDetails.limitations && dataSource.licenseType !== 'public' && (
            <Box>
              <Typography variant="body2">
                <strong>License Requirements:</strong>
              </Typography>
              {getLicenseLimitationsForDataSource(dataSource).map((limitation) => (
                <Typography key={limitation} variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  • {limitation}
                </Typography>
              ))}
            </Box>
          )}

          <Typography variant="body2" color="text.secondary">
            {dataSource.licenseType === 'public' 
              ? 'This data is in the public domain and free to use.'
              : 'By clicking the button below, you acknowledge that you have read and agree to comply with the licensing requirements.'
            }
          </Typography>

          <Button
            variant={licenseAgreement ? "outlined" : "contained"}
            color={licenseAgreement ? "success" : licenseColor === 'error' ? 'error' : 'primary'}
            size="large"
            startIcon={licenseAgreement ? <CheckCircleIcon /> : <OpenInNewIcon />}
            onClick={handleOpenLicensePage}
            fullWidth
            sx={{ mt: 2 }}
          >
            {licenseAgreement 
              ? `License Agreed - View ${dataSource.displayName} License`
              : `View ${dataSource.displayName} License Terms & Agree`
            }
          </Button>

          {showDetails.website && (
            <Link
              href={dataSource.website}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textAlign: 'center', display: 'block', mt: 1 }}
            >
              Visit {dataSource.displayName} Website
            </Link>
          )}
        </Stack>
      </Alert>

      {licenseAgreement && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Box>
              <Typography variant="body2">
                ✓ You have agreed to the {dataSource.license} license terms for {dataSource.displayName}
              </Typography>
              {licenseAgreedAt && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Agreed on: {new Date(licenseAgreedAt).toLocaleString()}
                </Typography>
              )}
            </Box>
          </Stack>
        </Alert>
      )}

      {/* Special warnings for restricted licenses */}
      {dataSource.licenseType === 'academic' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <WarningIcon color="warning" />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                Academic Use Only
              </Typography>
              <Typography variant="body2">
                This data source is restricted to academic and research purposes. 
                Commercial use requires separate permission from the data provider.
              </Typography>
            </Box>
          </Stack>
        </Alert>
      )}

      {dataSource.licenseType === 'commercial' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <WarningIcon color="error" />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                Commercial License Required
              </Typography>
              <Typography variant="body2">
                This data source requires a commercial license for use. 
                Please contact the data provider for licensing terms.
              </Typography>
            </Box>
          </Stack>
        </Alert>
      )}

      {dataSource.licenseType === 'varies' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <InfoIcon color="info" />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                Variable Licensing
              </Typography>
              <Typography variant="body2">
                This data source aggregates data from multiple providers with different license terms. 
                Please review the specific license for each dataset you intend to use.
              </Typography>
            </Box>
          </Stack>
        </Alert>
      )}
    </Box>
  );
};

// Helper function to get limitations specific to data source
function getLicenseLimitationsForDataSource(dataSource: DataSourceConfig): string[] {
  const baseLimitations = getLicenseLimitationsFromType(dataSource.licenseType);
  
  // Add data source specific limitations
  const specificLimitations: Record<string, string[]> = {
    [dataSource.name]: [],
  };

  // Add specific limitations based on data source
  if (dataSource.name.includes('gadm')) {
    specificLimitations[dataSource.name] = [
      'No redistribution allowed',
      'Must cite GADM in publications'
    ];
  }

  return [...baseLimitations, ...(specificLimitations[dataSource.name] || [])];
}

function getLicenseLimitationsFromType(licenseType: DataSourceConfig['licenseType']): string[] {
  switch (licenseType) {
    case 'public': return [];
    case 'cc': return ['Attribution required', 'Free for commercial use'];
    case 'academic': return ['Academic use only', 'Commercial use requires permission'];
    case 'odbl': return ['Attribution required', 'Share-alike license'];
    case 'mit': return ['Attribution required'];
    case 'commercial': return ['Commercial license required'];
    case 'varies': return ['License varies by data provider'];
    default: return ['Please check specific license terms'];
  }
}