import type { DetectionResult, FileLike, ParseOptions, TabularParseResult } from './types.js';

export interface TabularParserPort {
  id: string;

  detect(input: FileLike): Promise<DetectionResult> | DetectionResult;

  parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> | TabularParseResult;
}
