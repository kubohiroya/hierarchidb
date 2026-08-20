import {
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  type OriginCoordinatorCensusProbe,
} from '@hierarchidb/origin-coordinator';
import {
  initializeOriginCoordinatorStateDb,
  readOriginCoordinatorStateDb,
} from './originCoordinatorStateDbUtils.js';
import {
  parseOriginCoordinatorCensusResponse,
  parseOriginCoordinatorHelloRequest,
  parseOriginCoordinatorReadinessRequest,
} from './originCoordinatorValidatorUtils.js';
import type {
  OriginCoordinatorClientType,
  OriginCoordinatorClientTypeCounts,
  OriginCoordinatorHelloResult,
  OriginCoordinatorReadinessCounts,
  OriginCoordinatorReadinessResult,
} from './types.js';

export interface OriginCoordinatorServiceWorkerClient {
  readonly id: string;
  readonly type: OriginCoordinatorClientType;
  readonly url: string;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export interface OriginCoordinatorServiceWorkerClients {
  claim(): Promise<void>;
  get(id: string): Promise<OriginCoordinatorServiceWorkerClient | undefined>;
  matchAll(options: {
    readonly includeUncontrolled: true;
    readonly type: 'all';
  }): Promise<readonly OriginCoordinatorServiceWorkerClient[]>;
}

export interface OriginCoordinatorServiceWorkerRegistration {
  readonly scope: string;
}

export interface OriginCoordinatorExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

export interface OriginCoordinatorMessageEvent extends Event {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
  readonly source: OriginCoordinatorServiceWorkerClient | null;
  waitUntil(promise: Promise<unknown>): void;
}

export interface OriginCoordinatorServiceWorkerScope {
  readonly clients: OriginCoordinatorServiceWorkerClients;
  readonly indexedDB: IDBFactory;
  readonly registration: OriginCoordinatorServiceWorkerRegistration;
  addEventListener(
    type: 'install',
    listener: (event: OriginCoordinatorExtendableEvent) => void
  ): void;
  addEventListener(
    type: 'activate',
    listener: (event: OriginCoordinatorExtendableEvent) => void
  ): void;
  addEventListener(type: 'message', listener: (event: OriginCoordinatorMessageEvent) => void): void;
}

type ProbeStatus = 'compatible' | 'incompatible' | 'unresponsive' | 'discarded';

interface ProbeResult {
  readonly clientType: OriginCoordinatorClientType;
  readonly status: ProbeStatus;
}

const CLIENT_TYPE_ORDER: Readonly<Record<OriginCoordinatorClientType, number>> = Object.freeze({
  window: 0,
  worker: 1,
  sharedworker: 2,
});

function createEmptyClientTypeCounts(): OriginCoordinatorClientTypeCounts {
  return { compatible: 0, incompatible: 0, unresponsive: 0, discarded: 0 };
}

function freezeReadinessCounts(results: readonly ProbeResult[]): OriginCoordinatorReadinessCounts {
  const mutable: Record<OriginCoordinatorClientType, OriginCoordinatorClientTypeCounts> = {
    window: createEmptyClientTypeCounts(),
    worker: createEmptyClientTypeCounts(),
    sharedworker: createEmptyClientTypeCounts(),
  };
  for (const result of results) {
    const current = mutable[result.clientType];
    mutable[result.clientType] = {
      ...current,
      [result.status]: current[result.status] + 1,
    };
  }
  return Object.freeze({
    window: Object.freeze(mutable.window),
    worker: Object.freeze(mutable.worker),
    sharedworker: Object.freeze(mutable.sharedworker),
  });
}

function createEmptyReadinessCounts(): OriginCoordinatorReadinessCounts {
  return freezeReadinessCounts([]);
}

function isSupportedClientType(value: string): value is OriginCoordinatorClientType {
  return value === 'window' || value === 'worker' || value === 'sharedworker';
}

function postResponse(port: MessagePort, response: unknown): void {
  try {
    port.postMessage(response);
  } finally {
    port.close();
  }
}

export class OriginCoordinatorServiceWorker {
  constructor(
    private readonly scope: OriginCoordinatorServiceWorkerScope,
    private readonly expectedReleaseId: string
  ) {}

  install(): void {
    this.scope.addEventListener('install', (event) => {
      event.waitUntil(this.initializeDurableState());
    });
  }

  activate(): void {
    this.scope.addEventListener('activate', (event) => {
      event.waitUntil(this.scope.clients.claim());
    });
  }

  listen(): void {
    this.scope.addEventListener('message', (event) => {
      const responsePort = event.ports.length === 1 ? event.ports[0] : undefined;
      if (!responsePort || event.source === null) return;
      event.waitUntil(this.handleMessage(event.data, responsePort));
    });
  }

  private async initializeDurableState(): Promise<void> {
    const result = await initializeOriginCoordinatorStateDb(this.scope.indexedDB);
    if (!result.ok) {
      throw new Error(`origin-coordinator-install-failed:${result.code}`);
    }
  }

  private async handleMessage(data: unknown, responsePort: MessagePort): Promise<void> {
    const hello = parseOriginCoordinatorHelloRequest(data);
    if (hello !== null) {
      postResponse(responsePort, await this.createHelloResult(hello.releaseId));
      return;
    }
    const readiness = parseOriginCoordinatorReadinessRequest(data);
    if (readiness !== null) {
      postResponse(
        responsePort,
        await this.createReadinessResult(readiness.requestId, readiness.timeoutMs)
      );
      return;
    }
    const invalidHello: OriginCoordinatorHelloResult = Object.freeze({
      type: 'HDB_COORDINATOR_HELLO_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'rejected',
      code: 'INVALID_HELLO_REQUEST',
    });
    postResponse(responsePort, invalidHello);
  }

  private async createHelloResult(releaseId: string): Promise<OriginCoordinatorHelloResult> {
    if (releaseId !== this.expectedReleaseId) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: 'INVALID_HELLO_REQUEST',
      });
    }
    const state = await readOriginCoordinatorStateDb(this.scope.indexedDB);
    if (!state.ok) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: state.code,
      });
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_HELLO_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'accepted',
      legacyYamlAccess: state.state.phase,
    });
  }

  private async createReadinessResult(
    requestId: string,
    timeoutMs: number
  ): Promise<OriginCoordinatorReadinessResult> {
    const state = await readOriginCoordinatorStateDb(this.scope.indexedDB);
    if (!state.ok) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status: 'rejected',
        code: state.code,
        counts: createEmptyReadinessCounts(),
      });
    }

    let clients: readonly OriginCoordinatorServiceWorkerClient[];
    try {
      clients = await this.scope.clients.matchAll({ includeUncontrolled: true, type: 'all' });
    } catch {
      return Object.freeze({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status: 'rejected',
        code: 'CLIENT_CENSUS_FAILED',
        counts: createEmptyReadinessCounts(),
      });
    }

    const scopedClients = this.filterAndSortScopedClients(clients);
    const results = await Promise.all(
      scopedClients.map((client) => this.probeClient(client, requestId, timeoutMs))
    );
    const counts = freezeReadinessCounts(results);
    const incompatibleCount = results.filter((result) => result.status === 'incompatible').length;
    const unresponsiveCount = results.filter((result) => result.status === 'unresponsive').length;
    if (incompatibleCount > 0) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status: 'rejected',
        code: 'INCOMPATIBLE_CLIENT',
        counts,
      });
    }
    if (unresponsiveCount > 0) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_READINESS_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId,
        status: 'rejected',
        code: 'UNRESPONSIVE_CLIENT',
        counts,
      });
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_READINESS_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      status: 'accepted',
      counts,
    });
  }

  private filterAndSortScopedClients(
    clients: readonly OriginCoordinatorServiceWorkerClient[]
  ): readonly OriginCoordinatorServiceWorkerClient[] {
    const scopeUrl = new URL(this.scope.registration.scope);
    return clients
      .filter((client) => {
        if (!isSupportedClientType(client.type) || client.id.length === 0) return false;
        try {
          const clientUrl = new URL(client.url);
          return (
            clientUrl.origin === scopeUrl.origin && clientUrl.pathname.startsWith(scopeUrl.pathname)
          );
        } catch {
          return false;
        }
      })
      .sort((left, right) => {
        const kindOrder = CLIENT_TYPE_ORDER[left.type] - CLIENT_TYPE_ORDER[right.type];
        return kindOrder !== 0 ? kindOrder : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      });
  }

  private async probeClient(
    client: OriginCoordinatorServiceWorkerClient,
    requestId: string,
    timeoutMs: number
  ): Promise<ProbeResult> {
    const channel = new MessageChannel();
    const probe: OriginCoordinatorCensusProbe = Object.freeze({
      type: 'HDB_COORDINATOR_CENSUS_PROBE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
    });

    let cancelResponseWait = (): void => {};
    const responsePromise = new Promise<ProbeStatus>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (status: ProbeStatus): void => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        channel.port1.close();
        resolve(status);
      };
      cancelResponseWait = () => {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        channel.port1.close();
      };
      timer = setTimeout(() => {
        void this.scope.clients
          .get(client.id)
          .then((current) => finish(current === undefined ? 'discarded' : 'unresponsive'))
          .catch(() => finish('unresponsive'));
      }, timeoutMs);
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        const response = parseOriginCoordinatorCensusResponse(event.data);
        finish(
          response !== null &&
            response.requestId === requestId &&
            response.releaseId === this.expectedReleaseId
            ? 'compatible'
            : 'incompatible'
        );
      };
      channel.port1.onmessageerror = () => finish('incompatible');
      channel.port1.start();
    });

    try {
      client.postMessage(probe, [channel.port2]);
    } catch {
      cancelResponseWait();
      channel.port2.close();
      const current = await this.scope.clients.get(client.id).catch(() => undefined);
      return Object.freeze({
        clientType: client.type,
        status: current === undefined ? 'discarded' : 'unresponsive',
      });
    }
    const status = await responsePromise;
    return Object.freeze({ clientType: client.type, status });
  }
}
