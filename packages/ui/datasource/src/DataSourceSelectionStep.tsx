import type React from 'react';
import { Box, Typography } from '@mui/material';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import type { DataSourceSelectorProps, DataSourceOption } from './DataSourceSelector.js';
import { DataSourceDetailsCard } from './DataSourceDetailsCard.js';
import { DataSourceSelectionCard } from './DataSourceSelectionCard.js';
import { useDataSourceSelectionStep } from './useDataSourceSelectionStep.js';

export interface DataSourceSelectionOption extends DataSourceOption {
  licenseName: string;
  licenseUrl?: string;
  attribution?: string;
}

export interface DataSourceSelectionState<TAgreedAt = string | number | undefined> {
  dataSourceId?: string;
  licenseAgreement?: boolean;
  licenseAgreedAt?: TAgreedAt;
}

export interface DataSourceSelectionStepProps<TAgreedAt = string | number | undefined> {
  options: DataSourceSelectionOption[];
  state: DataSourceSelectionState<TAgreedAt>;
  onChange: (next: Partial<DataSourceSelectionState<TAgreedAt>>) => void;
  licenseRequired?: boolean;
  licenseRequiredText?: React.ReactNode;
  disabled?: boolean;
  showDetailsCard?: boolean;
  title?: string;
  description?: React.ReactNode;
  renderOption?: DataSourceSelectorProps['renderOption'];
  createAgreedAt?: () => TAgreedAt;
  renderDetails?: (
    selected: DataSourceSelectionOption,
    context: {
      agreedAtIso?: string;
      onAgree: () => void;
      state: DataSourceSelectionState<TAgreedAt>;
    },
  ) => React.ReactNode | null | undefined;
  selectionTitle?: string;
  detailsTitle?: string;
}

export const DataSourceSelectionStep = <TAgreedAt,>({
  options,
  state,
  onChange,
  licenseRequired = true,
  licenseRequiredText,
  disabled,
  showDetailsCard = true,
  title = 'Select Data Source',
  description,
  renderOption,
  createAgreedAt,
  renderDetails,
  detailsTitle = 'Data Source Details',
}: DataSourceSelectionStepProps<TAgreedAt>): React.JSX.Element => {
  const view = useDataSourceSelectionStep({
    options,
    state,
    onChange,
    createAgreedAt,
    renderDetails,
  });

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
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
      </Box>

      <DataSourceSelectionCard
        options={options}
        value={view.value}
        onChange={view.handleSelect}
        disabled={disabled}
        renderOption={renderOption}
      />

      {view.selected && showDetailsCard ? (
        <DataSourceDetailsCard title={detailsTitle}>
          {view.detailsContent ?? (
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
                licenseRequired
                  ? licenseRequiredText ?? (
                    <Typography variant="caption" color="text.secondary">
                      License agreement is required to proceed.
                    </Typography>
                  )
                  : undefined
              }
            />
          )}
        </DataSourceDetailsCard>
      ) : null}
    </Box>
  );
};
