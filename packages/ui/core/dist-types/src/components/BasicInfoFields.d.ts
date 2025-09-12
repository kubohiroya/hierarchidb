/**
 * BasicInfoFields
 * Shared name/description form fields for Step1 across plugins.
 */
import React from 'react';
export interface BasicInfoValue {
    name?: string;
    description?: string;
}
export interface BasicInfoFieldsProps {
    value: BasicInfoValue;
    onChange: (updates: Partial<BasicInfoValue>) => void;
    disabled?: boolean;
    nameMaxLength?: number;
    descriptionMaxLength?: number;
    nameLabel?: string;
    nameHelperText?: string;
    nameRequiredText?: string;
    namePlaceholder?: string;
    descriptionLabel?: string;
    descriptionHelperText?: string;
    descriptionPlaceholder?: string;
    title?: string;
    subtitle?: string;
}
export declare const BasicInfoFields: React.FC<BasicInfoFieldsProps>;
export default BasicInfoFields;
//# sourceMappingURL=BasicInfoFields.d.ts.map