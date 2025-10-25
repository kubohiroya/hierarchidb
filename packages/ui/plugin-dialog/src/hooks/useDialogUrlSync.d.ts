export type DialogModeState = 'full' | 'normal';
export interface DialogMapState {
    lng: number;
    lat: number;
    zoom: number;
}
export interface UseDialogUrlSyncOptions {
    namespace?: string;
    defaults?: {
        step?: number;
        mode?: DialogModeState;
        map?: DialogMapState;
    };
    debounce?: {
        step?: number;
        map?: number;
    };
    history?: {
        step?: 'push' | 'replace';
        mode?: 'replace';
        map?: 'replace';
    };
    readFrom?: 'search' | 'hash';
}
export declare function useDialogUrlSync(options?: UseDialogUrlSyncOptions): {
    step: number;
    setStep: import("react").Dispatch<import("react").SetStateAction<number>>;
    mode: DialogModeState;
    setMode: import("react").Dispatch<import("react").SetStateAction<DialogModeState>>;
    map: DialogMapState | undefined;
    setMap: import("react").Dispatch<import("react").SetStateAction<DialogMapState | undefined>>;
    clearParams: () => void;
};
//# sourceMappingURL=useDialogUrlSync.d.ts.map