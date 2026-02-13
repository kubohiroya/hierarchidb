/**
 * @file RouteDataSourceStep.tsx
 * @description Step 2: select data source for route generation.
 */

import { Stack, Typography } from '@mui/material';
import {
  DataSourceSelectionStep,
  IdeGsmImportPanel,
} from '@hierarchidb/ui-datasource';
import type { RouteEntity } from '@hierarchidb/route-api';
import { useRouteDataSourceStep } from './useRouteDataSourceStep.ts';

export interface RouteDataSourceStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
  nodeId?: string;
}

export const RouteDataSourceStep: React.FC<RouteDataSourceStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const {
    t,
    draft,
    resolvedSource,
    options,
    ideGsmLabels,
    importInProgress,
    handleSelectionChange,
    handleIdeGsmImport,
    handleIdeGsmClear,
  } = useRouteDataSourceStep({
    draft: draftProp,
    onUpdate,
    onValidationChange,
  });

  return (
    <DataSourceSelectionStep<number>
      title={t('dataSource.title', 'Data Source')}
      options={options}
      state={{
        dataSourceId: resolvedSource,
        licenseAgreement: Boolean(draft.licenseAgreement),
        licenseAgreedAt: draft.licenseAgreedAt,
      }}
      onChange={handleSelectionChange}
      disabled={disabled}
      description={t(
        'dataSource.description',
        'Choose the primary dataset or service that provides route geometry.',
      )}
      createAgreedAt={() => Date.now()}
      selectionTitle={t('dataSource.selectionTitle', 'Data Source')}
      detailsTitle={t('dataSource.detailsTitle', 'Data Source Details')}
      licenseRequiredText={t(
        'dataSource.licenseRequired',
        'License agreement is required to proceed.',
      )}
      showDetailsCard={false}
      renderOption={(option, active) => {
        const isIdeGsm = option.id === 'ide-gsm';
        return (
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">
              {option.icon} {option.name}
            </Typography>
            {option.description ? (
              <Typography variant="body2" color="text.secondary">
                {option.description}
              </Typography>
            ) : null}
            {isIdeGsm && active ? (
              <IdeGsmImportPanel
                fileName={draft.ideGsmFileName}
                sourceId={draft.tabularSourceId}
                sizeBytes={draft.ideGsmFileSizeBytes}
                labels={ideGsmLabels}
                defaultDownloadUrl={undefined}
                disabled={disabled || importInProgress}
                onChange={handleIdeGsmImport}
                onClear={handleIdeGsmClear}
              />
            ) : null}
          </Stack>
        );
      }}
    />
  );
};
