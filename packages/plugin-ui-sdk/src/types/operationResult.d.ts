/**
 * Database operation result
 */
export interface OperationResult<T = void> {
    success: boolean;
    data?: T;
    error?: Error;
    message?: string;
}
//# sourceMappingURL=operationResult.d.ts.map