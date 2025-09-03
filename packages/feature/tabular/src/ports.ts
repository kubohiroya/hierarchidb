import type { DetectionResult, ParseOptions, TabularChunk, TabularParseResult, FileLike } from './types';

export interface TabularParserPort {
  id: string;
  detect(input: FileLike): Promise<DetectionResult> | DetectionResult;
  parse(input: FileLike, options?: ParseOptions): Promise<TabularParseResult> | TabularParseResult;
}

