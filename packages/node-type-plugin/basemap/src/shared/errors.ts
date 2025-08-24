/**
 * Typed error classes for BaseMap plugin
 * Hierarchical error system for better error handling
 */

/**
 * Base validation error class
 */
export abstract class BaseMapValidationError extends Error {
  abstract readonly code: string;
  abstract readonly field?: string;
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Name validation error
 */
export class BaseMapNameValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_NAME_INVALID';
  readonly field = 'name';
  
  constructor(message: string = 'BaseMap name is invalid') {
    super(message);
  }
}

/**
 * Map style validation error
 */
export class BaseMapStyleValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_STYLE_INVALID';
  readonly field = 'mapStyle';
  
  constructor(message: string = 'BaseMap style is invalid') {
    super(message);
  }
}

/**
 * Coordinate validation error
 */
export class BaseMapCoordinateValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_COORDINATE_INVALID';
  readonly field = 'center';
  
  constructor(message: string = 'BaseMap coordinates are invalid') {
    super(message);
  }
}

/**
 * Zoom validation error
 */
export class BaseMapZoomValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_ZOOM_INVALID';
  readonly field = 'zoom';
  
  constructor(message: string = 'BaseMap zoom level is invalid') {
    super(message);
  }
}

/**
 * Style URL validation error
 */
export class BaseMapStyleUrlValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_STYLE_URL_INVALID';
  readonly field = 'styleUrl';
  
  constructor(message: string = 'BaseMap style URL is invalid') {
    super(message);
  }
}

/**
 * Style configuration validation error
 */
export class BaseMapStyleConfigValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_STYLE_CONFIG_INVALID';
  readonly field = 'styleConfig';
  
  constructor(message: string = 'BaseMap style configuration is invalid') {
    super(message);
  }
}

/**
 * Bounds validation error
 */
export class BaseMapBoundsValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_BOUNDS_INVALID';
  readonly field = 'bounds';
  
  constructor(message: string = 'BaseMap bounds are invalid') {
    super(message);
  }
}

/**
 * Comprehensive data validation error
 */
export class BaseMapDataValidationError extends BaseMapValidationError {
  readonly code = 'BASEMAP_DATA_INVALID';
  
  constructor(
    message: string,
    public readonly field: string,
    public readonly validationErrors: Array<{
      code: string;
      message: string;
      field?: string;
    }>
  ) {
    super(message);
  }
}

/**
 * Entity not found error
 */
export class BaseMapEntityNotFoundError extends Error {
  readonly code = 'BASEMAP_ENTITY_NOT_FOUND';
  
  constructor(nodeId: string, message: string = `BaseMap entity not found for node ${nodeId}`) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Database operation error
 */
export class BaseMapDatabaseError extends Error {
  readonly code = 'BASEMAP_DATABASE_ERROR';
  
  constructor(
    message: string,
    public readonly operation: 'create' | 'read' | 'update' | 'delete',
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * API communication error
 */
export class BaseMapApiError extends Error {
  readonly code = 'BASEMAP_API_ERROR';
  
  constructor(
    message: string,
    public readonly method: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Working copy error
 */
export class BaseMapWorkingCopyError extends Error {
  readonly code = 'BASEMAP_WORKING_COPY_ERROR';
  
  constructor(
    message: string,
    public readonly operation: 'create' | 'update' | 'commit' | 'discard',
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Type guard to check if error is BaseMap validation error
 */
export function isBaseMapValidationError(error: unknown): error is BaseMapValidationError {
  return error instanceof BaseMapValidationError;
}

/**
 * Type guard to check if error is BaseMap entity not found error
 */
export function isBaseMapEntityNotFoundError(error: unknown): error is BaseMapEntityNotFoundError {
  return error instanceof BaseMapEntityNotFoundError;
}

/**
 * Type guard to check if error is BaseMap database error
 */
export function isBaseMapDatabaseError(error: unknown): error is BaseMapDatabaseError {
  return error instanceof BaseMapDatabaseError;
}

/**
 * Type guard to check if error is BaseMap API error
 */
export function isBaseMapApiError(error: unknown): error is BaseMapApiError {
  return error instanceof BaseMapApiError;
}

/**
 * Error factory for creating specific validation errors
 */
export class BaseMapErrorFactory {
  static nameRequired(): BaseMapNameValidationError {
    return new BaseMapNameValidationError('BaseMap name is required');
  }
  
  static nameTooLong(maxLength: number): BaseMapNameValidationError {
    return new BaseMapNameValidationError(`BaseMap name must not exceed ${maxLength} characters`);
  }
  
  static invalidMapStyle(style: string): BaseMapStyleValidationError {
    return new BaseMapStyleValidationError(`Invalid map style: ${style}`);
  }
  
  static invalidCoordinates(lng: number, lat: number): BaseMapCoordinateValidationError {
    return new BaseMapCoordinateValidationError(`Invalid coordinates: [${lng}, ${lat}]`);
  }
  
  static invalidZoom(zoom: number): BaseMapZoomValidationError {
    return new BaseMapZoomValidationError(`Invalid zoom level: ${zoom}. Must be between 0 and 22`);
  }
  
  static invalidStyleUrl(url: string): BaseMapStyleUrlValidationError {
    return new BaseMapStyleUrlValidationError(`Invalid style URL: ${url}`);
  }
  
  static invalidStyleConfig(reason: string): BaseMapStyleConfigValidationError {
    return new BaseMapStyleConfigValidationError(`Invalid style configuration: ${reason}`);
  }
  
  static invalidBounds(bounds: any): BaseMapBoundsValidationError {
    return new BaseMapBoundsValidationError(`Invalid bounds: ${JSON.stringify(bounds)}`);
  }
  
  static entityNotFound(nodeId: string): BaseMapEntityNotFoundError {
    return new BaseMapEntityNotFoundError(nodeId);
  }
  
  static databaseOperation(operation: string, reason: string, originalError?: Error): BaseMapDatabaseError {
    return new BaseMapDatabaseError(
      `Database ${operation} failed: ${reason}`, 
      operation as any, 
      originalError
    );
  }
  
  static apiCall(method: string, reason: string, originalError?: Error): BaseMapApiError {
    return new BaseMapApiError(
      `API call ${method} failed: ${reason}`, 
      method, 
      originalError
    );
  }
  
  static workingCopy(operation: string, reason: string, originalError?: Error): BaseMapWorkingCopyError {
    return new BaseMapWorkingCopyError(
      `Working copy ${operation} failed: ${reason}`, 
      operation as any, 
      originalError
    );
  }
}