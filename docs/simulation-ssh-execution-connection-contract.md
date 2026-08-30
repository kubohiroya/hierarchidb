# Simulation SSH Execution Connection Contract

## Position

This document defines the SSH execution connection contract for external
simulation services.

It is a follow-up to:

- [#1460](https://github.com/kubohiroya/hierarchidb/issues/1460)
- [#1461](https://github.com/kubohiroya/hierarchidb/issues/1461)
- [#1725](https://github.com/kubohiroya/hierarchidb/issues/1725)

If this document conflicts with older text that treats SSH container
start/stop as a HierarchiDB application-server responsibility, this document
takes precedence.

## Ownership Model

For SSH execution, the simulation container reached over SSH is an externally
managed execution environment. From the application server's perspective, the
SSH endpoint is assumed to be already running and available unless a health or
connection check proves otherwise.

The application server does not own the lifecycle of that container.

HierarchiDB and the application server must not:

- provision the SSH target;
- start the SSH target container;
- stop the SSH target container;
- destroy or reset the SSH target container;
- reinterpret `remote` or `ec2` container lifecycle commands as SSH lifecycle
  operations.

Those operations belong to the external deployment environment, not to
HierarchiDB.

## Application-Server Responsibilities

The application server may perform only connection-scoped SSH responsibilities:

- resolve a named SSH-capable connection through the runtime provider;
- validate the current user's authorization to use that connection;
- validate the project-relative execution target before sending a request;
- send the authorized simulation command to the external service;
- observe task status, progress, result, and failure through the service's
  authoritative task API;
- surface stable public errors without exposing endpoints, credentials, raw
  command parameters, server absolute paths, or raw upstream exceptions.

The application server must not promote connection availability checks into
container ownership.

## Health And Availability

Health checks for SSH execution answer only whether the configured connection
is currently usable for the requested operation. They do not grant lifecycle
authority.

A health check may report states such as:

- incomplete connection input;
- checking;
- healthy;
- unhealthy;
- authentication-required;
- incompatible.

An unhealthy, unavailable, or incompatible SSH endpoint must fail the requested
operation before the command request. It must not trigger provisioning,
start/stop, retry through another connection type, or fallback to `remote` or
`ec2` lifecycle commands.

Health state remains a generic external-service concept. Service-specific
packages may adapt the labels and protocol checks, but reusable health state,
debounced checking, and presentation belong in service-neutral packages.

## Command Boundary

SSH simulation commands are command-execution operations, not lifecycle
operations.

Allowed SSH command mappings are limited to the authoritative upstream command
surface documented by the relevant Step 4 or project-command specification.
For YAML Step 4, `simulateSsh` and `calibrateSsh` are execution commands.
`start-container-ssh` and `stop-container-ssh` are not valid commands and must
not be added as aliases.

The client must reject undefined SSH commands before any network request.

## Forbidden Fallbacks

The implementation must fail closed when the SSH execution path cannot be used.
It must not:

- call `startContainerRemote`, `stopContainerRemote`, `startContainerEc2`, or
  `stopContainerEc2` for an SSH connection;
- call `simulateRemote` or `simulateEc2` as substitutes for `simulateSsh`;
- call `calibrateRemote` or `calibrateEc2` as substitutes for `calibrateSsh`;
- infer a different connection type from YAML content, filenames, server
  errors, or health failures;
- retry with a different command ID after an upstream rejection.

These failures are contract violations or unavailable-service states, not
compatibility cases.

## Verification Requirements

Follow-up implementation or regression-test issues should prove at least:

- the SSH command registry contains execution commands only;
- `start-container-ssh` and `stop-container-ssh` are rejected before network
  access;
- unavailable SSH health state prevents command launch without lifecycle
  fallback;
- `remote` and `ec2` lifecycle mutations are unreachable from SSH command
  paths;
- public errors do not expose endpoint URLs, credentials, raw upstream
  responses, or server absolute paths.

## Rollback

This contract introduces no runtime behavior by itself. Reverting it only
removes documentation. Any future runtime change that makes the application
server responsible for SSH container lifecycle management requires a new design
issue and an explicit API contract before implementation.
