import type React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector } from './DataSourceSelector.js';
import type { DataSourceOption, DataSourceSelectorProps } from './DataSourceSelector.js';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import { useDataSourceWithLicense } from './useDataSourceWithLicense.js';

export interface DataSourceWithLicenseOption extends DataSourceOption {
  licenseName: string;
  licenseUrl?: string;
  attribution?: string;
}

export interface DataSourceWithLicenseState<TAgreedAt = string | number | undefined> {
  dataSourceId?: string;
  licenseAgreement?: boolean;
  licenseAgreedAt?: TAgreedAt;
}

export interface DataSourceWithLicenseProps<TAgreedAt = string | number | undefined> {
  options: DataSourceWithLicenseOption[];
  state: DataSourceWithLicenseState<TAgreedAt>;
  onChange: (next: Partial<DataSourceWithLicenseState<TAgreedAt>>) => void;
  licenseRequired?: boolean;
  disabled?: boolean;
  description?: React.ReactNode;
  renderOption?: DataSourceSelectorProps['renderOption'];
  createAgreedAt?: () => TAgreedAt;
  renderLicenseExtra?: (selected?: DataSourceWithLicenseOption) => React.ReactNode;
}

export const DataSourceWithLicense = <TAgreedAt,>({
  options,
  state,
  onChange,
  licenseRequired = true,
  disabled,
  description,
  renderOption,
  createAgreedAt,
  renderLicenseExtra,
}: DataSourceWithLicenseProps<TAgreedAt>): React.JSX.Element => {
  const view = useDataSourceWithLicense({
    options,
    state,
    onChange,
    createAgreedAt,
  });

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {description ? (
        <Box>
          {typeof description === 'string' ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : (
            description
          )}
        </Box>
      ) : null}

      <DataSourceSelector
        options={options}
        value={view.value}
        onChange={view.handleSelect}
        disabled={disabled}
        renderOption={renderOption}
      />

      {view.selected ? (
        <LicenseAgreementStep
          sourceName={view.selected.name}
          details={{
            licenseName: view.selected.licenseName,
            attribution: view.selected.attribution,
            url: view.selected.licenseUrl,
          }}
          state={{
            agreed: Boolean(state.licenseAgreement),
            agreedAt: view.agreedAtIso,
          }}
          onAgree={view.handleAgree}
          disabled={disabled}
          renderExtra={
            licenseRequired || renderLicenseExtra ? (
              <Box display="flex" flexDirection="column" gap={1}>
                {licenseRequired ? (
                  <Typography variant="caption" color="text.secondary">
                    License agreement is required to proceed.
                  </Typography>
                ) : null}
                {renderLicenseExtra?.(view.selected)}
              </Box>
            ) : undefined
          }
        />
      ) : null}
    </Box>
  );
};
