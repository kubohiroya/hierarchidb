import {
  installOriginCoordinatorBridgeResponder,
  isOriginCoordinatorReleaseId,
  ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
  ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
} from '@hierarchidb/origin-coordinator';
import { OriginCoordinatorClientError } from './OriginCoordinatorClientError.js';
import {
  parseOriginCoordinatorHelloResult,
  parseOriginCoordinatorQuiescenceResult,
  parseOriginCoordinatorQuiescenceStartRequest,
  parseOriginCoordinatorQuiescenceStatusRequest,
  parseOriginCoordinatorReadinessRequest,
  parseOriginCoordinatorReadinessResult,
} from './originCoordinatorValidatorUtils.js';
import { readOriginCoordinatorSuccessorState } from './readOriginCoordinatorSuccessorState.js';
import type {
  OriginCoordinatorBootGate,
  OriginCoordinatorClientHandle,
  OriginCoordinatorHelloRequest,
  OriginCoordinatorInitializeOptions,
  OriginCoordinatorQuiescenceResult,
  OriginCoordinatorQuiescenceStartInput,
  OriginCoordinatorQuiescenceStartRequest,
  OriginCoordinatorQuiescenceStatusInput,
  OriginCoordinatorQuiescenceStatusRequest,
  OriginCoordinatorReadinessInput,
  OriginCoordinatorReadinessRequest,
  OriginCoordinatorReadinessResult,
} from './types.js';

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateOptions(options: OriginCoordinatorInitializeOptions): boolean {
  if (
    !isOriginCoordinatorReleaseId(options.releaseId) ||
    options.registrationUrl.length === 0 ||
    options.scope.length === 0 ||
    !isPositiveSafeInteger(options.activeWorkerTimeoutMs) ||
    !isPositiveSafeInteger(options.messageTimeoutMs) ||
    typeof options.relaySharedWorkerRequest !== 'function' ||
    typeof options.revokeLegacyYamlAccess !== 'function' ||
    options.activeWorkerTimeoutMs > ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS ||
    options.messageTimeoutMs > ORIGIN_COORDINATOR_MAX_CENSUS_TIMEOUT_MS
  ) {
    return false;
  }
  try {
    const registrationUrl = new URL(options.registrationUrl, window.location.href);
    const scopeUrl = new URL(options.scope, window.location.href);
    return (
      registrationUrl.origin === window.location.origin &&
      scopeUrl.origin === window.location.origin &&
      registrationUrl.pathname.startsWith(scopeUrl.pathname)
    );
  } catch {
    return false;
  }
}

function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorker> {
  if (registration.active?.state === 'activated') {
    return Promise.resolve(registration.active);
  }
  const candidate = registration.installing ?? registration.waiting ?? registration.active;
  if (!candidate) {
    return Promise.reject(new OriginCoordinatorClientError('ACTIVE_WORKER_TIMEOUT'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (worker: ServiceWorker | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      candidate.removeEventListener('statechange', onStateChange);
      if (worker) {
        resolve(worker);
      } else {
        reject(new OriginCoordinatorClientError('ACTIVE_WORKER_TIMEOUT'));
      }
    };
    const onStateChange = (): void => {
      if (candidate.state === 'activated') finish(candidate);
      if (candidate.state === 'redundant') finish(null);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    candidate.addEventListener('statechange', onStateChange);
    onStateChange();
  });
}

function sendCoordinatorRequest(
  worker: ServiceWorker,
  request: unknown,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (value: unknown, error: OriginCoordinatorClientError | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.close();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };
    const timer = setTimeout(
      () => finish(undefined, new OriginCoordinatorClientError('MESSAGE_TIMEOUT')),
      timeoutMs
    );
    channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(event.data, null);
    channel.port1.onmessageerror = () =>
      finish(undefined, new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE'));
    channel.port1.start();
    try {
      worker.postMessage(request, [channel.port2]);
    } catch {
      channel.port2.close();
      finish(undefined, new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE'));
    }
  });
}

function createClientHandle(
  worker: ServiceWorker,
  messageTimeoutMs: number
): OriginCoordinatorClientHandle {
  return Object.freeze({
    async getReadiness(
      input: OriginCoordinatorReadinessInput
    ): Promise<OriginCoordinatorReadinessResult> {
      const requestValue: OriginCoordinatorReadinessRequest = {
        type: 'HDB_COORDINATOR_READINESS_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        requestId: input.requestId,
        timeoutMs: input.timeoutMs,
      };
      const request = parseOriginCoordinatorReadinessRequest(requestValue);
      if (request === null) {
        throw new OriginCoordinatorClientError('INVALID_READINESS_INPUT');
      }
      const rawResult = await sendCoordinatorRequest(
        worker,
        request,
        request.timeoutMs + messageTimeoutMs
      );
      const result = parseOriginCoordinatorReadinessResult(rawResult);
      if (result === null || result.requestId !== request.requestId) {
        throw new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE');
      }
      return result;
    },
    async startQuiescence(
      input: OriginCoordinatorQuiescenceStartInput
    ): Promise<OriginCoordinatorQuiescenceResult> {
      const requestValue: OriginCoordinatorQuiescenceStartRequest = {
        type: 'HDB_COORDINATOR_QUIESCENCE_START_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        activationId: input.activationId,
        quiescenceRequestId: input.quiescenceRequestId,
        timeoutMs: input.timeoutMs,
      };
      const request = parseOriginCoordinatorQuiescenceStartRequest(requestValue);
      if (request === null) {
        throw new OriginCoordinatorClientError('INVALID_QUIESCENCE_INPUT');
      }
      const rawResult = await sendCoordinatorRequest(
        worker,
        request,
        request.timeoutMs + messageTimeoutMs
      );
      const result = parseOriginCoordinatorQuiescenceResult(rawResult);
      if (
        result === null ||
        (result.status !== 'request-rejected' &&
          (result.activationId !== request.activationId ||
            result.quiescenceRequestId !== request.quiescenceRequestId))
      ) {
        throw new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE');
      }
      return result;
    },
    async getQuiescenceStatus(
      input: OriginCoordinatorQuiescenceStatusInput
    ): Promise<OriginCoordinatorQuiescenceResult> {
      const requestValue: OriginCoordinatorQuiescenceStatusRequest = {
        type: 'HDB_COORDINATOR_QUIESCENCE_STATUS_REQUEST',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        activationId: input.activationId,
        quiescenceRequestId: input.quiescenceRequestId,
      };
      const request = parseOriginCoordinatorQuiescenceStatusRequest(requestValue);
      if (request === null) {
        throw new OriginCoordinatorClientError('INVALID_QUIESCENCE_INPUT');
      }
      const rawResult = await sendCoordinatorRequest(worker, request, messageTimeoutMs);
      const result = parseOriginCoordinatorQuiescenceResult(rawResult);
      if (
        result === null ||
        (result.status !== 'request-rejected' &&
          (result.activationId !== request.activationId ||
            result.quiescenceRequestId !== request.quiescenceRequestId))
      ) {
        throw new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE');
      }
      return result;
    },
  });
}

let initializationPromise: Promise<OriginCoordinatorBootGate> | null = null;

export function initializeOriginCoordinator(
  options: OriginCoordinatorInitializeOptions
): Promise<OriginCoordinatorBootGate> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      throw new OriginCoordinatorClientError('COORDINATOR_UNSUPPORTED');
    }
    if (!validateOptions(options)) {
      throw new OriginCoordinatorClientError('INVALID_INITIALIZE_OPTIONS');
    }
    if (
      !('serviceWorker' in navigator) ||
      typeof navigator.serviceWorker?.register !== 'function' ||
      typeof MessageChannel === 'undefined'
    ) {
      throw new OriginCoordinatorClientError('COORDINATOR_UNSUPPORTED');
    }
    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(options.registrationUrl, {
        scope: options.scope,
        type: 'module',
        updateViaCache: 'none',
      });
    } catch {
      throw new OriginCoordinatorClientError('REGISTRATION_FAILED');
    }
    const activeWorker = await waitForActiveWorker(registration, options.activeWorkerTimeoutMs);
    const hello: OriginCoordinatorHelloRequest = Object.freeze({
      type: 'HDB_COORDINATOR_HELLO',
      protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
      releaseId: options.releaseId,
      capabilities: Object.freeze([
        ORIGIN_COORDINATOR_FOUNDATION_CAPABILITY,
        ORIGIN_COORDINATOR_QUIESCENCE_BRIDGE_CAPABILITY,
      ] as const),
    });
    const rawResult = await sendCoordinatorRequest(activeWorker, hello, options.messageTimeoutMs);
    const result = parseOriginCoordinatorHelloResult(rawResult);
    if (result === null) {
      throw new OriginCoordinatorClientError('INVALID_COORDINATOR_RESPONSE');
    }
    if (result.status === 'rejected' && result.code === 'LEGACY_YAML_ACCESS_REVOKED') {
      if (typeof indexedDB === 'undefined') {
        throw new OriginCoordinatorClientError('HELLO_REJECTED');
      }
      const durableState = await readOriginCoordinatorSuccessorState(indexedDB);
      if (!durableState.ok) {
        throw new OriginCoordinatorClientError('HELLO_REJECTED');
      }
      return Object.freeze({
        status: 'canonical-revoked',
        coordinatorGate: 'revoked-ready-for-preflight',
        helloCode: result.code,
      });
    }
    if (result.status !== 'accepted') {
      throw new OriginCoordinatorClientError('HELLO_REJECTED');
    }
    installOriginCoordinatorBridgeResponder({
      target: navigator.serviceWorker,
      releaseId: options.releaseId,
      relaySharedWorkerRequest: options.relaySharedWorkerRequest,
      revokeLegacyYamlAccess: options.revokeLegacyYamlAccess,
    });
    return Object.freeze({
      status: 'activation-allowed',
      coordinator: createClientHandle(activeWorker, options.messageTimeoutMs),
    });
  })();
  return initializationPromise;
}
