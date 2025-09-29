import type React from 'react';
export interface LanguageSelectorProps {
    variant?: 'dropdown' | 'buttons' | 'compact';
    showFlags?: boolean;
    showNativeNames?: boolean;
    label?: string;
    size?: 'small' | 'medium';
    disabled?: boolean;
}
export declare const LanguageSelector: React.FC<LanguageSelectorProps>;
export default LanguageSelector;
//# sourceMappingURL=LanguageSelector.d.ts.map