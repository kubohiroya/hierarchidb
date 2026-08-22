import type { TabularParserPort } from './portTypes.js';
import type { DetectionResult, FileLike, ParseOptions, TabularParseResult } from './types.js';

const parsers: TabularParserPort[] = [];

export function registerParser(parser: TabularParserPort): void {
  parsers.push(parser);
}

export function listParsers(): ReadonlyArray<TabularParserPort> {
  return parsers;
}

export async function detectFormat(input: FileLike): Promise<DetectionResult> {
  const results: DetectionResult[] = [];
  for (const p of parsers) {
    try {
      const res = await p.detect(input);
      results.push(res);
    } catch {
      // ignore
    }
  }
  return (
    results.sort((a, b) => b.confidence - a.confidence)[0] ?? { format: 'unknown', confidence: 0 }
  );
}

export async function parseWithBest(
  input: FileLike,
  options?: ParseOptions
): Promise<TabularParseResult> {
  const result = await detectFormat(input);
  const candidate = parsers.find((p) => p.id === result.format);
  if (!candidate) throw new Error(`No parser registered for detected format: ${result.format}`);
  return candidate.parse(input, options);
}
