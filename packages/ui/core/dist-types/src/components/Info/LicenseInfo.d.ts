export interface LicenseData {
    licenses: string;
    repository?: string;
    publisher?: string;
    email?: string;
    url?: string;
    licenseFile?: string;
}
export interface LicenseRecord {
    [packageName: string]: LicenseData;
}
type OrderDirection = 'asc' | 'desc';
type OrderBy = 'name' | 'licenses';
export interface LicenseInfoProps {
    /**
     * License data to display
     */
    licenseData: LicenseRecord;
    /**
     * Title for the license section
     */
    title?: string;
    /**
     * Description text for the license section
     */
    description?: string;
    /**
     * Search placeholder text
     */
    searchPlaceholder?: string;
    /**
     * Custom function to determine license chip color
     */
    getLicenseColor?: (license: string) => 'success' | 'info' | 'warning' | 'default';
    /**
     * Whether to show the search bar
     */
    showSearch?: boolean;
    /**
     * Whether to show the count of packages
     */
    showCount?: boolean;
    /**
     * Initial sort order
     */
    initialOrderBy?: OrderBy;
    /**
     * Initial sort direction
     */
    initialOrderDirection?: OrderDirection;
}
export declare const LicenseInfo: React.FC<LicenseInfoProps>;
export {};
//# sourceMappingURL=LicenseInfo.d.ts.map