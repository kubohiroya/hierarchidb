# @hierarchidb/ide-gsm-client

Last updated: 2026-08-19

Typed GraphQL client for the IDE-GSM frontend API pinned by
`docs/yaml-plugin-ide-gsm-step4-spec.md`.

## YAML Step 4 commands

`IdeGsmClient.executeCommand()` accepts a discriminated `IdeGsmCommand` union
covering the 20 canonical commands. Each command maps to exactly one upstream
mutation. Unknown commands, invalid project paths, and invalid rsync connection
types fail before any network request; aliases and mutation fallbacks are not
provided.

Rsync inputs use `connectionType` plus optional `include` and `exclude` arrays.
Omitted arrays remain omitted and are not replaced with empty arrays. The `init`
command calls the upstream bootstrap mutation directly and never prepends
`importProject`.

`awaitTask(taskId, onStatus?)` validates the seven pinned upstream statuses.
`REGISTERED`, `READY`, and `LEASED` remain active; only `FINISHED` succeeds.
`FAILED`, `CANCELED`, `DELETED`, malformed events, unknown statuses, mismatched
task IDs, and early subscription completion fail and close the subscription.
Validated updates expose `id`, `status`, `paramsJson`, and `resultJson`.

Endpoint URLs and credentials are held only by the client instance for request
authentication. They are not written to URLs, logs, Web Storage, or IndexedDB,
and transport errors are returned without raw endpoint or credential content.

## Dependencies

- `graphql-request`
- `graphql-ws`
- peer: `graphql`

## Related Packages

- [`@hierarchidb/simulation-workflow`](../simulation-workflow/) — Simulation workflow orchestration

## License

MIT
