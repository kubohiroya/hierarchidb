declare module 'flatgeobuf/lib/mjs/geojson' {
  export function serialize(input: unknown): Promise<Uint8Array>;
  export function deserialize(
    input: Uint8Array,
    _rect?: unknown,
    _options?: unknown,
    _includeProperties?: boolean,
    _filters?: Record<string, unknown>
  ): unknown;
}
