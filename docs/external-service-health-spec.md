# External Service Health Contract

## Scope

HierarchiDB features may connect to external services such as IDE-GSM, catalog APIs, hosted processing runtimes, or future remote plugin backends. Their connection health state is a shared application contract, not a domain-specific IDE-GSM model. This document defines the health-specific subset of the broader external-service primitive rules in `docs/external-service-integration-spec.md`.

The canonical UI health contract lives in `@hierarchidb/ui-external-service-health`. Domain-specific connection packages may compose it, but they must not define their own incompatible health state unions or debounced health-check lifecycle.

## Package Boundary

`@hierarchidb/ui-external-service-health` owns:

- the canonical `ExternalServiceHealthStatus` union;
- the canonical `ExternalServiceHealthResult` payload;
- the generic `ExternalServiceHealthChecker<TInput>` port;
- the debounced `useExternalServiceHealth` hook, including stale-response suppression and abort handling.

`@hierarchidb/ui-external-service-connection` composes this package for the generic named-connection/manual-target step. Plugin-specific packages own only adapter labels, endpoint resolution, credentials, and service-specific checker implementation. For example, `@hierarchidb/ui-ide-gsm-connection` delegates connection UI, validation, health state, and check lifecycle to service-neutral packages.

## Canonical States

The canonical status values are:

- `incomplete`: required connection input is not yet available.
- `checking`: a health check for the latest input is in flight.
- `healthy`: the external service is reachable and satisfies the required authenticated contract.
- `unhealthy`: the service is unavailable or failed generic transport validation.
- `authentication-required`: the service is reachable but the current user/session cannot authenticate.
- `incompatible`: the service is reachable but does not satisfy the required version, capability, protocol, or feature contract.

Services may attach a stable machine-readable `code`, but must not expose raw endpoints, credentials, provider exception text, response bodies, filesystem paths, or service-specific secrets through health UI, logs, or persisted node data.

## Lifecycle Requirements

Health checks are ephemeral runtime state. They are not persisted in TreeNode `data`, `draftData`, IndexedDB, localStorage, URL parameters, or plugin metadata.

The checker must evaluate the latest complete connection input only. Stale or out-of-order responses must not replace the latest state. Aborted checks must not publish a terminal state.

The generic hook maps unexpected checker failures to `unhealthy` with a caller-supplied stable code. Domain checkers must explicitly return `authentication-required` and `incompatible` when those conditions are known; they must not collapse them into generic network failure.
