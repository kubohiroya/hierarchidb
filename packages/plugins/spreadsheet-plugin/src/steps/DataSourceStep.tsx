/**
  * :
 * : React
 * : TC-101-002
 * :
  */

import React from 'react';
import { CSVUploadPanel } from './CSVUploadPanel.js';
import { useTranslation } from 'react-i18next';

/**
  * : DataSourceStep
 * :
  */
export interface DataSourceStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

/**
  * :
 * :
 * : RefactorUI
 * :
  */
export const DataSourceStep: React.FC<DataSourceStepProps> = ({ data: _data, onNext, onPrevious, errors }) => {
  const { t } = useTranslation('spreadsheet-plugin');

  return (
    <div>
      <h3>{t('dataSource.title', 'Data Source Selection')}</h3>
      <p>{t('dataSource.description', 'Step 2: Select your data source')}</p>

      {/* CSV Upload/URL Download UI using new adapter */}
      <CSVUploadPanel
        pluginId="spreadsheet"
        onUploaded={(meta) => onNext(meta)}
        onError={(msg) => console.error(msg)}
      />

      {errors && errors.length > 0 && (
        <div>
          {errors.map((error, index) => (
            <p key={index} style={{ color: 'red' }}>{error}</p>
          ))}
        </div>
      )}

      <button onClick={onPrevious}>{t('navigation.previous', 'Previous')}</button>
    </div>
  );
};
