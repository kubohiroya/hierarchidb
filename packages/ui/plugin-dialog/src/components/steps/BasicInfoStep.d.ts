/**
 * Basic Information Step Component
 * Common first step for all plugin dialogs
 */
import type React from 'react';
export interface BasicInfoData {
    name: string;
    description: string;
    tags?: string[];
}
export interface BasicInfoStepProps {
    /** Current name value */
    name: string;
    /** Current description value */
    description: string;
    /** Current tags */
    tags?: string[];
    /** Change handler */
    onChange: (data: BasicInfoData) => void;
    /** Dialog mode */
    mode: 'create' | 'edit';
    /** Optional custom validation */
    validate?: (data: BasicInfoData) => string | null;
    /** Optional tag suggestions */
    tagSuggestions?: string[];
}
/**
 * Basic Information Step Component
 */
export declare const BasicInfoStep: React.FC<BasicInfoStepProps>;
//# sourceMappingURL=BasicInfoStep.d.ts.map