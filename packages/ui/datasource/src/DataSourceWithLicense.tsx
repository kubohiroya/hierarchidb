import type React from 'react';
import { Box, Typography } from '@mui/material';
import { DataSourceSelector } from './DataSourceSelector.js';
import type { DataSourceOption, DataSourceSelectorProps } from './DataSourceSelector.js';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';

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
  const fallbackValue = options[0]?.id ?? '';
  const value = state.dataSourceId ?? fallbackValue;
  const selected = options.find((option) => option.id === value);

  const agreedAtIso = state.licenseAgreedAt
    ? typeof state.licenseAgreedAt === 'number'
      ? new Date(state.licenseAgreedAt).toISOString()
      : String(state.licenseAgreedAt)
    : undefined;

  const handleSelect = (next: string) => {
    onChange({
      dataSourceId: next,
      licenseAgreement: false,
      licenseAgreedAt: undefined,
    });
  };

  const handleAgree = () => {
    const buildAgreedAt =
      createAgreedAt ??
      (() => new Date().toISOString() as TAgreedAt);
    if (selected?.licenseUrl) {
      window.open(selected.licenseUrl, '_blank', 'noopener,noreferrer');
    }
    onChange({
      licenseAgreement: true,
      licenseAgreedAt: buildAgreedAt(),
    });
  };

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
        value={value}
        onChange={handleSelect}
        disabled={disabled}
        renderOption={renderOption}
      />

      {selected ? (
        <LicenseAgreementStep
          sourceName={selected.name}
          details={{
            licenseName: selected.licenseName,
            attribution: selected.attribution,
            url: selected.licenseUrl,
          }}
          state={{
            agreed: Boolean(state.licenseAgreement),
            agreedAt: agreedAtIso,
          }}
          onAgree={handleAgree}
          disabled={disabled}
          renderExtra={
            licenseRequired || renderLicenseExtra ? (
              <Box display="flex" flexDirection="column" gap={1}>
                {licenseRequired ? (
                  <Typography variant="caption" color="text.secondary">
                    License agreement is required to proceed.
                  </Typography>
                ) : null}
                {renderLicenseExtra?.(selected)}
              </Box>
            ) : undefined
          }
        />
      ) : null}
    </Box>
  );
};
