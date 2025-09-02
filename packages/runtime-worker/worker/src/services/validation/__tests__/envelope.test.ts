import { describe, expect, it } from 'vitest';
import { createEnvelopeSchema, validateAndNormalizeEnvelope } from '~/services/validation/envelope';

describe('Envelope validation (ZE-2)', () => {
  it('accepts envelope with kind', () => {
    const input = {
      commandId: 'cmd-1',
      groupId: 'grp-1',
      kind: 'createNode',
      payload: { any: 'data' },
      issuedAt: Date.now(),
    };
    const r = validateAndNormalizeEnvelope(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.envelope.kind).toBe('createNode');
      expect(r.envelope.type).toBe('createNode');
    }
  });

  it('accepts envelope with type and normalizes to kind', () => {
    const input = {
      commandId: 'cmd-2',
      groupId: 'grp-2',
      type: 'updateNode',
      payload: { x: 1 },
      issuedAt: Date.now(),
    };
    const r = validateAndNormalizeEnvelope(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.envelope.kind).toBe('updateNode');
      expect(r.envelope.type).toBe('updateNode');
    }
  });

  it('rejects when both kind and type are missing', () => {
    const input = {
      commandId: 'cmd-3',
      groupId: 'grp-3',
      payload: {},
      issuedAt: Date.now(),
    } as any;
    const r = validateAndNormalizeEnvelope(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('kind');
  });

  it('enforces commandId length upper bound', () => {
    const tooLong = 'a'.repeat(101);
    const input = {
      commandId: tooLong,
      groupId: 'grp',
      type: 'ping',
      payload: {},
      issuedAt: Date.now(),
    };
    const r = validateAndNormalizeEnvelope(input);
    expect(r.ok).toBe(false);
  });

  it('enforces allowed characters for kind/type (permissive)', () => {
    const input = {
      commandId: 'cmd-4',
      groupId: 'grp-4',
      type: 'invalid:type', // colon not allowed by our regex
      payload: {},
      issuedAt: Date.now(),
    };
    const r = validateAndNormalizeEnvelope(input);
    expect(r.ok).toBe(false);
  });

  it('schema factory builds zod schema', () => {
    const schema = createEnvelopeSchema();
    const parsed = schema.safeParse({
      commandId: 'cmd-5',
      groupId: 'grp-5',
      kind: 'ping',
      payload: null,
      issuedAt: Date.now(),
    });
    expect(parsed.success).toBe(true);
  });
});
