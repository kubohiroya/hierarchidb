/** Stable error codes returned by strict YAML contract validators. */
export const YAML_CONTRACT_ERROR_CODES = [
  'UNKNOWN_SUBTYPE',
  'UNKNOWN_COMMAND',
  'COMMAND_NOT_ALLOWED',
  'UNKNOWN_SCHEMA',
  'UNKNOWN_FILENAME',
  'SCHEMA_MISMATCH',
  'FILENAME_MISMATCH',
] as const;

/** A stable YAML contract validation error code. */
export type YamlContractErrorCode = (typeof YAML_CONTRACT_ERROR_CODES)[number];

/** An explicit contract violation raised before a consumer performs I/O. */
export class YamlContractError extends Error {
  constructor(
    public readonly code: YamlContractErrorCode,
    message: string,
    public readonly context: Readonly<Record<string, unknown>> = {}
  ) {
    super(message);
    this.name = 'YamlContractError';
  }
}
