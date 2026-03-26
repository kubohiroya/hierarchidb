import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { IdeGsmClient, deriveWsUrl } from '../src/IdeGsmClient.js';
import type { WsClientFactory } from '../src/IdeGsmClient.js';
import type { Client as WsClient } from 'graphql-ws';

// Helper types and factories for mocking graphql-ws
type SinkLike = {
  next: (v: unknown) => void;
  complete: () => void;
  error: (e: unknown) => void;
};

function makeMockWsClient(onSubscribe: (sink: SinkLike) => () => void): WsClient {
  return {
    subscribe: (_op: unknown, sink: SinkLike) => onSubscribe(sink),
    dispose: () => Promise.resolve(),
    on: () => () => { /* noop */ },
    terminate: () => { /* noop */ },
    iterate: async function* () { /* noop */ },
  } as unknown as WsClient;
}

function makeWsFactory(onSubscribe: (sink: SinkLike) => () => void): WsClientFactory {
  return () => makeMockWsClient(onSubscribe);
}

// Feature: ide-gsm-client, Property 1: WebSocket URL scheme derivation
describe('Property 1: WebSocket URL scheme derivation', () => {
  it('http:// derives ws://', () => {
    fc.assert(
      fc.property(
        fc.webAuthority({ withPort: true }).map((auth) => `http://${auth}`),
        (url) => {
          const wsUrl = deriveWsUrl(url);
          expect(wsUrl.startsWith('ws://')).toBe(true);
          expect(wsUrl.startsWith('wss://')).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('https:// derives wss://', () => {
    fc.assert(
      fc.property(
        fc.webAuthority({ withPort: true }).map((auth) => `https://${auth}`),
        (url) => {
          expect(deriveWsUrl(url).startsWith('wss://')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('derived URL always ends with /graphql', () => {
    fc.assert(
      fc.property(
        fc.webAuthority({ withPort: true }).map((auth) => `http://${auth}`),
        (url) => {
          expect(deriveWsUrl(url).endsWith('/graphql')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('deriveWsUrl edge cases', () => {
  it('strips trailing slash', () => {
    expect(deriveWsUrl('http://localhost:8080/')).toBe('ws://localhost:8080/graphql');
  });

  it('appends /graphql', () => {
    expect(deriveWsUrl('http://localhost:8080')).toBe('ws://localhost:8080/graphql');
  });

  it('handles https with port', () => {
    expect(deriveWsUrl('https://example.com:443')).toBe('wss://example.com:443/graphql');
  });
});

// Feature: ide-gsm-client, Property 5: ExportFilter fields included/omitted correctly
describe('Property 5: ExportFilter fields included/omitted correctly', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('omits include and exclude when filter is undefined', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.fn().mockResolvedValue({ exportProject: 'task-1' });
    vi.spyOn(GraphQLClient.prototype, 'request').mockImplementation(spy);
    await new IdeGsmClient('http://localhost:8080', 'token').exportProject('/p');
    const [, vars] = spy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect('include' in vars).toBe(false);
    expect('exclude' in vars).toBe(false);
  });

  it('includes include when defined', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.fn().mockResolvedValue({ exportProject: 'task-2' });
    vi.spyOn(GraphQLClient.prototype, 'request').mockImplementation(spy);
    await new IdeGsmClient('http://localhost:8080', 'token').exportProject('/p', { include: ['*.yml'] });
    const [, vars] = spy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(vars['include']).toEqual(['*.yml']);
    expect('exclude' in vars).toBe(false);
  });

  it('property: arbitrary filter combinations produce correct variables shape', async () => {
    const { GraphQLClient } = await import('graphql-request');
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          include: fc.option(fc.array(fc.string()), { nil: undefined }),
          exclude: fc.option(fc.array(fc.string()), { nil: undefined }),
        }),
        async (filter) => {
          const spy = vi.fn().mockResolvedValue({ exportProject: 'x' });
          vi.spyOn(GraphQLClient.prototype, 'request').mockImplementation(spy);
          const filterArg = filter.include !== undefined || filter.exclude !== undefined ? filter : undefined;
          await new IdeGsmClient('http://localhost:8080', 'token').exportProject('/p', filterArg);
          const [, vars] = spy.mock.calls[0] as [unknown, Record<string, unknown>];
          expect('include' in vars).toBe(filterArg?.include !== undefined);
          expect('exclude' in vars).toBe(filterArg?.exclude !== undefined);
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: ide-gsm-client, Property 3: mutation round-trip taskId
describe('Property 3: mutation round-trip taskId', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('importProject returns server taskId', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const { GraphQLClient } = await import('graphql-request');
        vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValue({ importProject: taskId });
        const result = await new IdeGsmClient('http://localhost:8080', 'token').importProject('snap', '/p');
        expect(result).toBe(taskId);
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  });

  it('calibrate returns server taskId', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const { GraphQLClient } = await import('graphql-request');
        vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValue({ calibrate: taskId });
        const result = await new IdeGsmClient('http://localhost:8080', 'token').calibrate('/p');
        expect(result).toBe(taskId);
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  });

  it('simulate returns server taskId', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const { GraphQLClient } = await import('graphql-request');
        vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValue({ simulate: taskId });
        const result = await new IdeGsmClient('http://localhost:8080', 'token').simulate('/p');
        expect(result).toBe(taskId);
        vi.restoreAllMocks();
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: ide-gsm-client, Property 6: awaitTask round-trip identity
describe('Property 6: awaitTask round-trip identity', () => {
  it('result.id equals taskId on FINISHED', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const factory = makeWsFactory((sink) => {
          setTimeout(() => sink.next({ data: { subscribeTaskOnFrontend: { id: taskId, status: 'FINISHED', paramsJson: '{}' } } }), 0);
          return () => { /* noop */ };
        });
        const result = await new IdeGsmClient('http://localhost:8080', 'token', factory).awaitTask(taskId);
        expect(result.id).toBe(taskId);
        expect(result.status).toBe('FINISHED');
      }),
      { numRuns: 50 },
    );
  });
});

// Feature: ide-gsm-client, Property 7: FAILED or CANCELED status causes awaitTask to throw
describe('Property 7: FAILED/CANCELED causes awaitTask to throw', () => {
  it('throws containing FAILED in message', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const factory = makeWsFactory((sink) => {
          setTimeout(() => sink.next({ data: { subscribeTaskOnFrontend: { id: taskId, status: 'FAILED', paramsJson: '{}' } } }), 0);
          return () => { /* noop */ };
        });
        await expect(new IdeGsmClient('http://localhost:8080', 'token', factory).awaitTask(taskId)).rejects.toThrow('FAILED');
      }),
      { numRuns: 50 },
    );
  });

  it('throws containing CANCELED in message', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const factory = makeWsFactory((sink) => {
          setTimeout(() => sink.next({ data: { subscribeTaskOnFrontend: { id: taskId, status: 'CANCELED', paramsJson: '{}' } } }), 0);
          return () => { /* noop */ };
        });
        await expect(new IdeGsmClient('http://localhost:8080', 'token', factory).awaitTask(taskId)).rejects.toThrow('CANCELED');
      }),
      { numRuns: 50 },
    );
  });
});

// Feature: ide-gsm-client, Property 8: Unexpected WebSocket close causes awaitTask to throw
describe('Property 8: WebSocket close before terminal status throws', () => {
  it('throws when subscription completes without terminal status', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (taskId) => {
        const factory = makeWsFactory((sink) => {
          setTimeout(() => sink.complete(), 0);
          return () => { /* noop */ };
        });
        await expect(new IdeGsmClient('http://localhost:8080', 'token', factory).awaitTask(taskId)).rejects.toThrow(taskId);
      }),
      { numRuns: 50 },
    );
  });
});
