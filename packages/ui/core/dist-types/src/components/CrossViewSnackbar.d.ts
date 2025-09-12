export declare function CrossViewSnackbar({ datasetId, autoHideDuration, format }: {
    datasetId: string;
    autoHideDuration?: number;
    format?: (ev: {
        source: 'row' | 'feature';
        id: string | number;
        data?: any;
    }) => {
        title?: string;
        message?: string;
    };
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=CrossViewSnackbar.d.ts.map