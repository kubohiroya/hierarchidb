/** Terminal status values for an IDE-GSM async task. */
export type TaskStatus = 'FINISHED' | 'FAILED' | 'CANCELED';

/** Payload received from the subscribeTaskOnFrontend WebSocket subscription. */
export interface TaskResult {
    id: string;
    status: TaskStatus;
    paramsJson: string;
}

/**
 * Optional file-glob filter for exportProject.
 * When omitted, IDE-GSM applies its own default filter.
 */
export interface ExportFilter {
    include?: string[];
    exclude?: string[];
}
