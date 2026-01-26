import type React from 'react';
import { Box, Typography } from '@mui/material';
import { LicenseAgreementStep } from '@hierarchidb/ui-license';
import type { DataSourceSelectorProps, DataSourceOption } from './DataSourceSelector.js';
import { DataSourceDetailsCard } from './DataSourceDetailsCard.js';
import { DataSourceSelectionCard } from './DataSourceSelectionCard.js';

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
  selectionTitle = 'Data Source',
  detailsTitle = 'Data Source Details',
}: DataSourceSelectionStepProps<TAgreedAt>): React.JSX.Element => {
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
      (() => new Date().toISOString() as unknown as TAgreedAt);
    if (selected?.licenseUrl) {
      window.open(selected.licenseUrl, '_blank', 'noopener,noreferrer');
    }
    onChange({
      licenseAgreement: true,
      licenseAgreedAt: buildAgreedAt(),
    });
  };

  const detailsContent = selected
    ? renderDetails?.(selected, { agreedAtIso, onAgree: handleAgree, state })
    : null;

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
        title={selectionTitle}
        options={options}
        value={value}
        onChange={handleSelect}
        disabled={disabled}
        renderOption={renderOption}
      />

      {selected && showDetailsCard ? (
        <DataSourceDetailsCard title={detailsTitle}>
          {detailsContent ?? (
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
