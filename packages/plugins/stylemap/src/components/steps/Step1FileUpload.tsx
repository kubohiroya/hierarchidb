/**
 * @file Step1FileUpload.tsx
 * @description StyleMap import step 1 - file upload
 */

import React from 'react';

export interface Step1FileUploadProps {
  onNext: (file: File) => void;
}

export const Step1FileUpload: React.FC<Step1FileUploadProps> = ({ onNext: _onNext }) => {
  return (
    <div>
      <h3>Step 1: File Upload</h3>
      {/* TODO: Implement file upload interface */}
      <input type="file" accept=".csv,.tsv" />
    </div>
  );
};

export default Step1FileUpload;
