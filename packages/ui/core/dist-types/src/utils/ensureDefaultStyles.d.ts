export interface EnsureDefaultStylesOptions {
    includeRow?: boolean;
    includeMap?: boolean;
}
/**
 * Ensure a minimal default style dictionary exists for a dataset channel.
 * Adds 'match' (priority 5), 'hover' (10), 'select' (20) entries.
 * Row styles are light (outline / background), map side uses feature-state flags.
 */
export declare function ensureDefaultStyles(datasetId: string, opts?: EnsureDefaultStylesOptions): void;
//# sourceMappingURL=ensureDefaultStyles.d.ts.map