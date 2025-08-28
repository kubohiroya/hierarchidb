"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerErrorCode = void 0;
// Worker-specific ErrorCode enum for runtime use
// Includes all Core error codes plus worker-specific ones
exports.WorkerErrorCode = {
    // Core error codes
    NAME_NOT_UNIQUE: 'NAME_NOT_UNIQUE',
    STALE_VERSION: 'STALE_VERSION',
    HAS_INBOUND_REFS: 'HAS_INBOUND_REFS',
    ILLEGAL_RELATION: 'ILLEGAL_RELATION',
    NODE_NOT_FOUND: 'NODE_NOT_FOUND',
    INVALID_OPERATION: 'INVALID_OPERATION',
    // Worker-specific error codes
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    WORKING_COPY_NOT_FOUND: 'WORKING_COPY_NOT_FOUND',
    COMMIT_CONFLICT: 'COMMIT_CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
};
