import {
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  type OriginCoordinatorCensusProbe,
  type OriginCoordinatorParticipantQuiescenceRequest,
  type OriginCoordinatorParticipantQuiescenceResult,
  type OriginCoordinatorSharedWorkerRelayRequest,
  parseOriginCoordinatorParticipantQuiescenceResult,
} from '@hierarchidb/origin-coordinator';
import {
  createYamlStorageLegacyFence,
  reduceYamlStorageLegacyFence,
  type YamlStorageLegacyFenceEvent,
  type YamlStorageLegacyFenceState,
} from '@hierarchidb/runtime-worker/yaml-storage-legacy-fence';
import {
  initializeOriginCoordinatorStateDb,
  readOriginCoordinatorStateDb,
  transitionOriginCoordinatorStateDb,
} from './originCoordinatorStateDbUtils.js';
import {
  parseOriginCoordinatorCensusResponse,
  parseOriginCoordinatorHelloRequest,
  parseOriginCoordinatorQuiescenceStartRequest,
  parseOriginCoordinatorQuiescenceStatusRequest,
  parseOriginCoordinatorReadinessRequest,
  readOriginCoordinatorMessageType,
} from './originCoordinatorValidatorUtils.js';
import type {
  OriginCoordinatorBridgeErrorCode,
  OriginCoordinatorBridgeErrorStage,
  OriginCoordinatorClientType,
  OriginCoordinatorClientTypeCounts,
  OriginCoordinatorDurableState,
  OriginCoordinatorHelloResult,
  OriginCoordinatorPersistedParticipant,
  OriginCoordinatorPersistedParticipantEvidence,
  OriginCoordinatorQuiescenceRequestErrorCode,
  OriginCoordinatorQuiescenceResult,
  OriginCoordinatorQuiescenceStartRequest,
  OriginCoordinatorQuiescenceStatusRequest,
  OriginCoordinatorReadinessCounts,
  OriginCoordinatorReadinessResult,
  OriginCoordinatorRejectedState,
  OriginCoordinatorRevokedState,
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

type ParticipantTransportResult =
  | {
      readonly status: 'result';
      readonly result: OriginCoordinatorParticipantQuiescenceResult;
    }
  | { readonly status: 'unresponsive' }
  | { readonly status: 'lookup-failed' }
  | { readonly status: 'invalid-response' }
  | { readonly status: 'discarded' };

interface ActiveQuiescence {
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly promise: Promise<OriginCoordinatorQuiescenceResult>;
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

function hasSameIdentity(
  state: Exclude<OriginCoordinatorDurableState, { readonly phase: 'allowed' }>,
  request: OriginCoordinatorQuiescenceStartRequest | OriginCoordinatorQuiescenceStatusRequest
): boolean {
  return (
    state.activationId === request.activationId &&
    state.quiescenceRequestId === request.quiescenceRequestId
  );
}

function hasSameParticipants(
  left: readonly OriginCoordinatorPersistedParticipant[],
  right: readonly OriginCoordinatorPersistedParticipant[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (participant, index) =>
        participant.participantKind === right[index]?.participantKind &&
        participant.participantId === right[index]?.participantId
    )
  );
}

function hasSameEvidence(
  left: readonly OriginCoordinatorPersistedParticipantEvidence[],
  right: readonly OriginCoordinatorPersistedParticipantEvidence[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (evidence, index) =>
        evidence.participantKind === right[index]?.participantKind &&
        evidence.participantId === right[index]?.participantId &&
        evidence.outcome === right[index]?.outcome
    )
  );
}

function postResponse(port: MessagePort, response: unknown): void {
  try {
    port.postMessage(response);
  } finally {
    port.close();
  }
}

function createQuiescenceRequestRejection(
  code: OriginCoordinatorQuiescenceRequestErrorCode
): OriginCoordinatorQuiescenceResult {
  return Object.freeze({
    type: 'HDB_COORDINATOR_QUIESCENCE_RESULT',
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    status: 'request-rejected',
    actualFenceEstablished: false,
    code,
  });
}

function createEvidence(
  state: YamlStorageLegacyFenceState
): readonly OriginCoordinatorPersistedParticipantEvidence[] {
  const evidence: OriginCoordinatorPersistedParticipantEvidence[] = [];
  for (const participant of state.participants) {
    if (
      state.acknowledgedParticipants.some(
        (acknowledged) => acknowledged.participantId === participant.participantId
      )
    ) {
      evidence.push(Object.freeze({ ...participant, outcome: 'acknowledged' }));
      continue;
    }
    if (
      state.discardedParticipants.some(
        (discarded) => discarded.participantId === participant.participantId
      )
    ) {
      evidence.push(Object.freeze({ ...participant, outcome: 'discarded' }));
    }
  }
  return Object.freeze(evidence);
}

function createProgress(state: OriginCoordinatorRevokedState | OriginCoordinatorRejectedState) {
  return Object.freeze({
    participantCount: state.participants.length,
    acknowledgedCount: state.evidence.filter((item) => item.outcome === 'acknowledged').length,
    discardedCount: state.evidence.filter((item) => item.outcome === 'discarded').length,
  });
}

function createQuiescenceResult(
  state: OriginCoordinatorRevokedState | OriginCoordinatorRejectedState
): OriginCoordinatorQuiescenceResult {
  const common = {
    type: 'HDB_COORDINATOR_QUIESCENCE_RESULT' as const,
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    activationId: state.activationId,
    quiescenceRequestId: state.quiescenceRequestId,
    actualFenceEstablished: false as const,
    progress: createProgress(state),
  };
  if (state.phase === 'rejected') {
    return Object.freeze({
      ...common,
      status: 'rejected',
      errorCode: state.errorCode,
      errorStage: state.errorStage,
    });
  }
  return Object.freeze({ ...common, status: state.status });
}

function reconstructFenceState(
  state: OriginCoordinatorRevokedState | OriginCoordinatorRejectedState
): YamlStorageLegacyFenceState | null {
  const created = createYamlStorageLegacyFence({
    activationId: state.activationId,
    quiescenceRequestId: state.quiescenceRequestId,
    participants: state.participants,
  });
  if (!created.ok) return null;
  let fenceState: YamlStorageLegacyFenceState = created.state;
  for (const evidence of state.evidence) {
    const event: YamlStorageLegacyFenceEvent =
      evidence.outcome === 'acknowledged'
        ? {
            type: 'participant-quiescence-acknowledged',
            activationId: state.activationId,
            quiescenceRequestId: state.quiescenceRequestId,
            participantKind: evidence.participantKind,
            participantId: evidence.participantId,
            legacyYamlEntrypointsRevoked: true,
            ownedStorageHandlesClosed: true,
          }
        : {
            type: 'participant-context-discarded',
            activationId: state.activationId,
            quiescenceRequestId: state.quiescenceRequestId,
            participantKind: evidence.participantKind,
            participantId: evidence.participantId,
          };
    const reduced = reduceYamlStorageLegacyFence(fenceState, event);
    if (!reduced.ok || reduced.state.phase === 'rejected') return null;
    fenceState = reduced.state;
  }
  if (
    state.phase === 'revoked' &&
    ((state.status === 'quiescing' && fenceState.phase !== 'quiescing') ||
      (state.status === 'ready-for-preflight' && fenceState.phase !== 'ready-for-preflight'))
  ) {
    return null;
  }
  return fenceState;
}

export class OriginCoordinatorServiceWorker {
  private activeQuiescence: ActiveQuiescence | null = null;

  constructor(private readonly scope: OriginCoordinatorServiceWorkerScope) {}

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
      event.waitUntil(this.handleMessage(event.data, event.source, responsePort));
    });
  }

  private async initializeDurableState(): Promise<void> {
    const result = await initializeOriginCoordinatorStateDb(this.scope.indexedDB);
    if (!result.ok) throw new Error(`origin-coordinator-install-failed:${result.code}`);
  }

  private async handleMessage(
    data: unknown,
    source: OriginCoordinatorServiceWorkerClient,
    responsePort: MessagePort
  ): Promise<void> {
    const hello = parseOriginCoordinatorHelloRequest(data);
    if (hello !== null) {
      postResponse(responsePort, await this.createHelloResult());
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
    const startRequest = parseOriginCoordinatorQuiescenceStartRequest(data);
    if (startRequest !== null) {
      postResponse(responsePort, await this.startQuiescence(startRequest, source));
      return;
    }
    const statusRequest = parseOriginCoordinatorQuiescenceStatusRequest(data);
    if (statusRequest !== null) {
      postResponse(responsePort, await this.getQuiescenceStatus(statusRequest));
      return;
    }
    if (
      readOriginCoordinatorMessageType(data) === 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST' ||
      readOriginCoordinatorMessageType(data) === 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST'
    ) {
      postResponse(responsePort, createQuiescenceRequestRejection('INVALID_QUIESCENCE_REQUEST'));
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

  private async readReconstructedState(): Promise<
    | { readonly ok: true; readonly state: OriginCoordinatorDurableState }
    | {
        readonly ok: false;
        readonly code: 'COORDINATOR_STORAGE_FAILED' | 'INVALID_DURABLE_STATE';
      }
  > {
    const result = await readOriginCoordinatorStateDb(this.scope.indexedDB);
    if (!result.ok) return result;
    if (result.state.phase !== 'allowed' && reconstructFenceState(result.state) === null) {
      return Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
    }
    return result;
  }

  private async createHelloResult(): Promise<OriginCoordinatorHelloResult> {
    const state = await this.readReconstructedState();
    if (!state.ok) {
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: state.code,
      });
    }
    if (state.state.phase === 'allowed') {
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'accepted',
        legacyYamlAccess: 'allowed',
      });
    }
    if (
      state.state.phase === 'revoked' &&
      state.state.status === 'quiescing' &&
      this.activeQuiescence === null
    ) {
      const rejected = await this.rejectRestartedQuiescence(state.state);
      if (rejected.status === 'request-rejected') {
        return Object.freeze({
          type: 'HDB_COORDINATOR_HELLO_RESULT',
          protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
          status: 'rejected',
          code:
            rejected.code === 'COORDINATOR_STORAGE_FAILED'
              ? 'COORDINATOR_STORAGE_FAILED'
              : 'INVALID_DURABLE_STATE',
        });
      }
      return Object.freeze({
        type: 'HDB_COORDINATOR_HELLO_RESULT',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        status: 'rejected',
        code: 'LEGACY_YAML_ACCESS_REJECTED',
      });
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_HELLO_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      status: 'rejected',
      code:
        state.state.phase === 'rejected'
          ? 'LEGACY_YAML_ACCESS_REJECTED'
          : 'LEGACY_YAML_ACCESS_REVOKED',
    });
  }

  private createReadinessRejection(
    requestId: string,
    code: Extract<OriginCoordinatorReadinessResult, { readonly status: 'rejected' }>['code'],
    counts = createEmptyReadinessCounts()
  ): OriginCoordinatorReadinessResult {
    return Object.freeze({
      type: 'HDB_COORDINATOR_READINESS_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      status: 'rejected',
      actualFenceEstablished: false,
      code,
      counts,
    });
  }

  private async createReadinessResult(
    requestId: string,
    timeoutMs: number
  ): Promise<OriginCoordinatorReadinessResult> {
    const state = await this.readReconstructedState();
    if (!state.ok) return this.createReadinessRejection(requestId, state.code);
    if (state.state.phase !== 'allowed') {
      if (
        state.state.phase === 'revoked' &&
        state.state.status === 'quiescing' &&
        this.activeQuiescence === null
      ) {
        const rejected = await this.rejectRestartedQuiescence(state.state);
        if (rejected.status === 'request-rejected') {
          return this.createReadinessRejection(
            requestId,
            rejected.code === 'COORDINATOR_STORAGE_FAILED'
              ? 'COORDINATOR_STORAGE_FAILED'
              : 'INVALID_DURABLE_STATE'
          );
        }
        return this.createReadinessRejection(requestId, 'LEGACY_YAML_ACCESS_REJECTED');
      }
      return this.createReadinessRejection(
        requestId,
        state.state.phase === 'rejected'
          ? 'LEGACY_YAML_ACCESS_REJECTED'
          : 'LEGACY_YAML_ACCESS_REVOKED'
      );
    }

    let clients: readonly OriginCoordinatorServiceWorkerClient[];
    try {
      clients = await this.scope.clients.matchAll({ includeUncontrolled: true, type: 'all' });
    } catch {
      return this.createReadinessRejection(requestId, 'CLIENT_CENSUS_FAILED');
    }
    const scopedClients = this.filterAndSortScopedClients(clients);
    const relayWindows = scopedClients.filter((client) => client.type === 'window');
    const sharedWorkerUrlCounts = this.createSharedWorkerUrlCounts(scopedClients);
    const results = await Promise.all(
      scopedClients.map((client) =>
        client.type === 'sharedworker' && sharedWorkerUrlCounts.get(client.url) !== 1
          ? Object.freeze({ clientType: client.type, status: 'incompatible' as const })
          : this.probeClient(client, relayWindows, requestId, timeoutMs)
      )
    );
    const counts = freezeReadinessCounts(results);
    if (results.some((result) => result.status === 'incompatible')) {
      return this.createReadinessRejection(requestId, 'INCOMPATIBLE_CLIENT', counts);
    }
    if (results.some((result) => result.status === 'unresponsive')) {
      return this.createReadinessRejection(requestId, 'UNRESPONSIVE_CLIENT', counts);
    }
    if (counts.window.compatible < 1) {
      return this.createReadinessRejection(requestId, 'MISSING_PRODUCTION_WINDOW', counts);
    }
    if (counts.sharedworker.compatible < 1) {
      return this.createReadinessRejection(requestId, 'MISSING_PRODUCTION_SHARED_WORKER', counts);
    }
    return Object.freeze({
      type: 'HDB_COORDINATOR_READINESS_RESULT',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
      status: 'accepted',
      actualFenceEstablished: false,
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

  private createSharedWorkerUrlCounts(
    clients: readonly OriginCoordinatorServiceWorkerClient[]
  ): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const client of clients) {
      if (client.type !== 'sharedworker') continue;
      counts.set(client.url, (counts.get(client.url) ?? 0) + 1);
    }
    return counts;
  }

  private hasUniqueSharedWorkerUrls(
    clients: readonly OriginCoordinatorServiceWorkerClient[]
  ): boolean {
    return [...this.createSharedWorkerUrlCounts(clients).values()].every((count) => count === 1);
  }

  private async probeClient(
    client: OriginCoordinatorServiceWorkerClient,
    relayWindows: readonly OriginCoordinatorServiceWorkerClient[],
    requestId: string,
    timeoutMs: number
  ): Promise<ProbeResult> {
    const probe: OriginCoordinatorCensusProbe = Object.freeze({
      type: 'HDB_COORDINATOR_CENSUS_PROBE',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      requestId,
    });
    if (client.type === 'sharedworker') {
      return Object.freeze({
        clientType: client.type,
        status: await this.probeSharedWorker(client, relayWindows, probe, timeoutMs),
      });
    }
    const channel = new MessageChannel();
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
          response !== null && response.requestId === requestId ? 'compatible' : 'incompatible'
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
      try {
        const current = await this.scope.clients.get(client.id);
        return Object.freeze({
          clientType: client.type,
          status: current === undefined ? 'discarded' : 'unresponsive',
        });
      } catch {
        return Object.freeze({ clientType: client.type, status: 'unresponsive' });
      }
    }
    return Object.freeze({ clientType: client.type, status: await responsePromise });
  }

  private probeSharedWorker(
    client: OriginCoordinatorServiceWorkerClient,
    relayWindows: readonly OriginCoordinatorServiceWorkerClient[],
    probe: OriginCoordinatorCensusProbe,
    timeoutMs: number
  ): Promise<ProbeStatus> {
    return new Promise((resolve) => {
      const responsePorts = new Set<MessagePort>();
      let settled = false;
      let successfulDispatchCount = 0;
      const finish = (status: ProbeStatus): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        for (const port of responsePorts) port.close();
        responsePorts.clear();
        resolve(status);
      };
      const verifyDiscard = (): void => {
        if (settled) return;
        void this.scope.clients
          .get(client.id)
          .then((current) => finish(current === undefined ? 'discarded' : 'unresponsive'))
          .catch(() => finish('unresponsive'));
      };
      const timer = setTimeout(verifyDiscard, timeoutMs);
      const relayRequest: OriginCoordinatorSharedWorkerRelayRequest = Object.freeze({
        type: 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        targetClientId: client.id,
        targetClientUrl: client.url,
        request: probe,
      });
      for (const relayWindow of relayWindows) {
        const channel = new MessageChannel();
        responsePorts.add(channel.port1);
        channel.port1.onmessage = (event: MessageEvent<unknown>) => {
          const response = parseOriginCoordinatorCensusResponse(event.data);
          finish(
            response !== null && response.requestId === probe.requestId
              ? 'compatible'
              : 'incompatible'
          );
        };
        channel.port1.onmessageerror = () => finish('incompatible');
        channel.port1.start();
        try {
          relayWindow.postMessage(relayRequest, [channel.port2]);
          successfulDispatchCount += 1;
        } catch {
          responsePorts.delete(channel.port1);
          channel.port1.close();
          channel.port2.close();
        }
      }
      if (successfulDispatchCount === 0) verifyDiscard();
    });
  }

  private startQuiescence(
    request: OriginCoordinatorQuiescenceStartRequest,
    source: OriginCoordinatorServiceWorkerClient
  ): Promise<OriginCoordinatorQuiescenceResult> {
    if (this.activeQuiescence !== null) {
      return this.activeQuiescence.activationId === request.activationId &&
        this.activeQuiescence.quiescenceRequestId === request.quiescenceRequestId
        ? this.activeQuiescence.promise
        : Promise.resolve(createQuiescenceRequestRejection('QUIESCENCE_IDENTITY_MISMATCH'));
    }
    const promise = this.claimAndRunQuiescence(request, source);
    const active: ActiveQuiescence = Object.freeze({
      activationId: request.activationId,
      quiescenceRequestId: request.quiescenceRequestId,
      promise,
    });
    this.activeQuiescence = active;
    const clearActive = (): void => {
      if (this.activeQuiescence === active) this.activeQuiescence = null;
    };
    void promise.then(clearActive, clearActive);
    return promise;
  }

  private async claimAndRunQuiescence(
    request: OriginCoordinatorQuiescenceStartRequest,
    source: OriginCoordinatorServiceWorkerClient
  ): Promise<OriginCoordinatorQuiescenceResult> {
    let clients: readonly OriginCoordinatorServiceWorkerClient[];
    try {
      clients = this.filterAndSortScopedClients(
        await this.scope.clients.matchAll({ includeUncontrolled: true, type: 'all' })
      );
    } catch {
      return createQuiescenceRequestRejection('CLIENT_CENSUS_FAILED');
    }
    if (!clients.some((client) => client.id === source.id)) {
      return createQuiescenceRequestRejection('CLIENT_CENSUS_FAILED');
    }
    if (!this.hasUniqueSharedWorkerUrls(clients)) {
      return createQuiescenceRequestRejection('CLIENT_CENSUS_FAILED');
    }
    const participants: readonly OriginCoordinatorPersistedParticipant[] = Object.freeze(
      clients.map((client) =>
        Object.freeze({
          participantKind: client.type === 'window' ? ('tab' as const) : ('worker' as const),
          participantId: client.id,
        })
      )
    );
    const created = createYamlStorageLegacyFence({
      activationId: request.activationId,
      quiescenceRequestId: request.quiescenceRequestId,
      participants,
    });
    if (!created.ok) return createQuiescenceRequestRejection('CLIENT_CENSUS_FAILED');
    const claimed = await transitionOriginCoordinatorStateDb(this.scope.indexedDB, (state) => {
      if (state.phase !== 'allowed') return null;
      return Object.freeze({
        key: state.key,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'revoked' as const,
        status: 'quiescing' as const,
        activationId: request.activationId,
        quiescenceRequestId: request.quiescenceRequestId,
        participants: created.state.participants,
        evidence: Object.freeze([] as OriginCoordinatorPersistedParticipantEvidence[]),
      });
    });
    if (!claimed.ok) {
      if (claimed.code !== 'TRANSITION_REJECTED') {
        return createQuiescenceRequestRejection(claimed.code);
      }
      if (claimed.state.phase === 'allowed' || !hasSameIdentity(claimed.state, request)) {
        return createQuiescenceRequestRejection('QUIESCENCE_IDENTITY_MISMATCH');
      }
      if (claimed.state.phase === 'revoked' && claimed.state.status === 'quiescing') {
        return await this.rejectRestartedQuiescence(claimed.state);
      }
      return createQuiescenceResult(claimed.state);
    }
    if (claimed.state.phase !== 'revoked') {
      return createQuiescenceRequestRejection('INVALID_DURABLE_STATE');
    }

    const clientById = new Map(clients.map((client) => [client.id, client] as const));
    const relayWindows = clients.filter((client) => client.type === 'window');
    const dispatchClients = [
      ...clients.filter((client) => client.type === 'sharedworker'),
      ...clients.filter((client) => client.type === 'worker'),
      ...relayWindows,
    ];
    const transportByClientId = new Map<string, Promise<ParticipantTransportResult>>();
    for (const client of dispatchClients) {
      const participant = claimed.state.participants.find(
        (candidate) => candidate.participantId === client.id
      );
      if (!participant) continue;
      transportByClientId.set(
        client.id,
        this.requestParticipantQuiescence(client, relayWindows, participant, request)
      );
    }
    const transportPromises = claimed.state.participants.map((participant) => {
      const client = clientById.get(participant.participantId);
      const transport = client ? transportByClientId.get(client.id) : undefined;
      return transport ?? Promise.resolve({ status: 'invalid-response' as const });
    });
    const transportResults = await Promise.all(transportPromises);
    let fenceState: YamlStorageLegacyFenceState = created.state;
    let durableState: OriginCoordinatorRevokedState = claimed.state;
    for (let index = 0; index < transportResults.length; index += 1) {
      const transport = transportResults[index];
      const participant = durableState.participants[index];
      if (!transport || !participant) {
        return await this.persistTerminalRejection(
          durableState,
          'LEGACY_FENCE_REJECTED',
          'quiescing'
        );
      }
      if (transport.status === 'lookup-failed') {
        return await this.persistTerminalRejection(
          durableState,
          'CLIENT_LOOKUP_FAILED',
          'quiescing'
        );
      }
      if (transport.status === 'unresponsive') {
        return await this.persistTerminalRejection(
          durableState,
          'PARTICIPANT_UNRESPONSIVE',
          'quiescing'
        );
      }
      let event: YamlStorageLegacyFenceEvent;
      if (transport.status === 'discarded') {
        event = {
          type: 'participant-context-discarded',
          activationId: request.activationId,
          quiescenceRequestId: request.quiescenceRequestId,
          participantKind: participant.participantKind,
          participantId: participant.participantId,
        };
      } else if (transport.status === 'invalid-response') {
        return await this.persistTerminalRejection(
          durableState,
          'LEGACY_FENCE_REJECTED',
          'quiescing'
        );
      } else {
        const result = transport.result;
        event =
          result.status === 'acknowledged'
            ? {
                type: 'participant-quiescence-acknowledged',
                activationId: result.activationId,
                quiescenceRequestId: result.quiescenceRequestId,
                participantKind: result.participantKind,
                participantId: result.participantId,
                legacyYamlEntrypointsRevoked: result.legacyYamlEntrypointsRevoked,
                ownedStorageHandlesClosed: result.ownedStorageHandlesClosed,
              }
            : {
                type: 'participant-quiescence-failed',
                activationId: result.activationId,
                quiescenceRequestId: result.quiescenceRequestId,
                participantKind: result.participantKind,
                participantId: result.participantId,
              };
      }
      const reduced = reduceYamlStorageLegacyFence(fenceState, event);
      if (!reduced.ok || reduced.state.phase === 'rejected') {
        return await this.persistTerminalRejection(
          durableState,
          'LEGACY_FENCE_REJECTED',
          'quiescing'
        );
      }
      fenceState = reduced.state;
      const nextState: OriginCoordinatorRevokedState = Object.freeze({
        key: durableState.key,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'revoked',
        status: fenceState.phase,
        activationId: durableState.activationId,
        quiescenceRequestId: durableState.quiescenceRequestId,
        participants: durableState.participants,
        evidence: createEvidence(fenceState),
      });
      const persisted = await transitionOriginCoordinatorStateDb(this.scope.indexedDB, (current) =>
        current.phase === 'revoked' &&
        current.status === durableState.status &&
        hasSameIdentity(current, request) &&
        hasSameParticipants(current.participants, durableState.participants) &&
        hasSameEvidence(current.evidence, durableState.evidence)
          ? nextState
          : null
      );
      if (!persisted.ok) {
        return createQuiescenceRequestRejection(
          persisted.code === 'TRANSITION_REJECTED' ? 'INVALID_DURABLE_STATE' : persisted.code
        );
      }
      if (persisted.state.phase !== 'revoked') {
        return createQuiescenceRequestRejection('INVALID_DURABLE_STATE');
      }
      durableState = persisted.state;
    }
    return createQuiescenceResult(durableState);
  }

  private async requestParticipantQuiescence(
    client: OriginCoordinatorServiceWorkerClient,
    relayWindows: readonly OriginCoordinatorServiceWorkerClient[],
    participant: OriginCoordinatorPersistedParticipant,
    request: OriginCoordinatorQuiescenceStartRequest
  ): Promise<ParticipantTransportResult> {
    const participantRequest: OriginCoordinatorParticipantQuiescenceRequest = Object.freeze({
      type: 'HDB_COORDINATOR_PARTICIPANT_QUIESCENCE_REQUEST',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      activationId: request.activationId,
      quiescenceRequestId: request.quiescenceRequestId,
      participantKind: participant.participantKind,
      participantId: participant.participantId,
    });
    if (client.type === 'sharedworker') {
      return await this.requestSharedWorkerQuiescence(
        client,
        relayWindows,
        participantRequest,
        request.timeoutMs
      );
    }
    const channel = new MessageChannel();
    const responsePromise = new Promise<ParticipantTransportResult>((resolve) => {
      let settled = false;
      let lookupStarted = false;
      const finish = (result: ParticipantTransportResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        channel.port1.close();
        resolve(result);
      };
      const verifyDiscard = (): void => {
        if (settled || lookupStarted) return;
        lookupStarted = true;
        void this.scope.clients
          .get(client.id)
          .then((current) =>
            finish({ status: current === undefined ? 'discarded' : 'unresponsive' })
          )
          .catch(() => finish({ status: 'lookup-failed' }));
      };
      const timer = setTimeout(verifyDiscard, request.timeoutMs);
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        const result = parseOriginCoordinatorParticipantQuiescenceResult(event.data);
        if (
          result === null ||
          result.activationId !== request.activationId ||
          result.quiescenceRequestId !== request.quiescenceRequestId ||
          result.participantKind !== participant.participantKind ||
          result.participantId !== participant.participantId
        ) {
          finish({ status: 'invalid-response' });
          return;
        }
        finish({ status: 'result', result });
      };
      channel.port1.onmessageerror = verifyDiscard;
      channel.port1.start();
      try {
        client.postMessage(participantRequest, [channel.port2]);
      } catch {
        channel.port2.close();
        verifyDiscard();
      }
    });
    return await responsePromise;
  }

  private requestSharedWorkerQuiescence(
    client: OriginCoordinatorServiceWorkerClient,
    relayWindows: readonly OriginCoordinatorServiceWorkerClient[],
    participantRequest: OriginCoordinatorParticipantQuiescenceRequest,
    timeoutMs: number
  ): Promise<ParticipantTransportResult> {
    return new Promise((resolve) => {
      const responsePorts = new Set<MessagePort>();
      let settled = false;
      let lookupStarted = false;
      let successfulDispatchCount = 0;
      const finish = (result: ParticipantTransportResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        for (const port of responsePorts) port.close();
        responsePorts.clear();
        resolve(result);
      };
      const verifyDiscard = (): void => {
        if (settled || lookupStarted) return;
        lookupStarted = true;
        void this.scope.clients
          .get(client.id)
          .then((current) =>
            finish({ status: current === undefined ? 'discarded' : 'unresponsive' })
          )
          .catch(() => finish({ status: 'lookup-failed' }));
      };
      const timer = setTimeout(verifyDiscard, timeoutMs);
      const relayRequest: OriginCoordinatorSharedWorkerRelayRequest = Object.freeze({
        type: 'HDB_COORDINATOR_SHARED_WORKER_RELAY_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        targetClientId: client.id,
        targetClientUrl: client.url,
        request: participantRequest,
      });
      for (const relayWindow of relayWindows) {
        const channel = new MessageChannel();
        responsePorts.add(channel.port1);
        channel.port1.onmessage = (event: MessageEvent<unknown>) => {
          const result = parseOriginCoordinatorParticipantQuiescenceResult(event.data);
          if (
            result === null ||
            result.activationId !== participantRequest.activationId ||
            result.quiescenceRequestId !== participantRequest.quiescenceRequestId ||
            result.participantKind !== participantRequest.participantKind ||
            result.participantId !== participantRequest.participantId
          ) {
            finish({ status: 'invalid-response' });
            return;
          }
          finish({ status: 'result', result });
        };
        channel.port1.onmessageerror = verifyDiscard;
        channel.port1.start();
        try {
          relayWindow.postMessage(relayRequest, [channel.port2]);
          successfulDispatchCount += 1;
        } catch {
          responsePorts.delete(channel.port1);
          channel.port1.close();
          channel.port2.close();
        }
      }
      if (successfulDispatchCount === 0) verifyDiscard();
    });
  }

  private async persistTerminalRejection(
    state: OriginCoordinatorRevokedState,
    errorCode: OriginCoordinatorBridgeErrorCode,
    errorStage: OriginCoordinatorBridgeErrorStage
  ): Promise<OriginCoordinatorQuiescenceResult> {
    const persisted = await transitionOriginCoordinatorStateDb(this.scope.indexedDB, (current) => {
      if (
        current.phase !== 'revoked' ||
        current.activationId !== state.activationId ||
        current.quiescenceRequestId !== state.quiescenceRequestId ||
        !hasSameParticipants(current.participants, state.participants) ||
        !hasSameEvidence(current.evidence, state.evidence)
      ) {
        return null;
      }
      return Object.freeze({
        key: current.key,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'rejected' as const,
        activationId: current.activationId,
        quiescenceRequestId: current.quiescenceRequestId,
        participants: current.participants,
        evidence: current.evidence,
        errorCode,
        errorStage,
      });
    });
    if (!persisted.ok) {
      return createQuiescenceRequestRejection(
        persisted.code === 'TRANSITION_REJECTED' ? 'INVALID_DURABLE_STATE' : persisted.code
      );
    }
    return persisted.state.phase === 'rejected'
      ? createQuiescenceResult(persisted.state)
      : createQuiescenceRequestRejection('INVALID_DURABLE_STATE');
  }

  private async rejectRestartedQuiescence(
    state: OriginCoordinatorRevokedState
  ): Promise<OriginCoordinatorQuiescenceResult> {
    return await this.persistTerminalRejection(
      state,
      'COORDINATOR_RESTARTED_DURING_QUIESCENCE',
      'reconstruction'
    );
  }

  private async getQuiescenceStatus(
    request: OriginCoordinatorQuiescenceStatusRequest
  ): Promise<OriginCoordinatorQuiescenceResult> {
    const readResult = await this.readReconstructedState();
    if (!readResult.ok) return createQuiescenceRequestRejection(readResult.code);
    if (readResult.state.phase === 'allowed') {
      return createQuiescenceRequestRejection('QUIESCENCE_IDENTITY_MISMATCH');
    }
    if (!hasSameIdentity(readResult.state, request)) {
      return createQuiescenceRequestRejection('QUIESCENCE_IDENTITY_MISMATCH');
    }
    if (
      readResult.state.phase === 'revoked' &&
      readResult.state.status === 'quiescing' &&
      (this.activeQuiescence === null ||
        this.activeQuiescence.activationId !== request.activationId ||
        this.activeQuiescence.quiescenceRequestId !== request.quiescenceRequestId)
    ) {
      return await this.rejectRestartedQuiescence(readResult.state);
    }
    return createQuiescenceResult(readResult.state);
  }
}
