export interface UseWorkingCopyOptions {
    nodeType: string;
    mode: 'create' | 'edit';
    nodeId?: string;
    parentId?: string;
}
export interface UseWorkingCopyResult<T = any> {
    wcId: string | null;
    workingCopy: T | null;
    setWorkingCopy: (updater: (prev: T) => T) => void;
    init: () => Promise<void>;
    commit: () => Promise<void>;
    discard: () => Promise<void>;
    loading: boolean;
    error: unknown;
}
export declare function useWorkingCopy<T = any>(opts: UseWorkingCopyOptions): UseWorkingCopyResult<T>;
//# sourceMappingURL=useWorkingCopy.d.ts.map