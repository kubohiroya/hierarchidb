import type {
  CanonicalYamlSnapshotWorkflowErrorCode,
  CanonicalYamlSnapshotWorkflowErrorContext,
} from './canonicalYamlSnapshotTypes.js';

/** Sanitized failure from the production canonical YAML snapshot workflow. */
export class CanonicalYamlSnapshotWorkflowError extends Error {
  readonly code: CanonicalYamlSnapshotWorkflowErrorCode;
  readonly context: CanonicalYamlSnapshotWorkflowErrorContext;

  constructor(
    code: CanonicalYamlSnapshotWorkflowErrorCode,
    context: CanonicalYamlSnapshotWorkflowErrorContext = {}
  ) {
    super(`Canonical YAML snapshot workflow failed: ${code}`);
    this.name = 'CanonicalYamlSnapshotWorkflowError';
    this.code = code;
    this.context = Object.freeze({
      ...(context.step === undefined ? {} : { step: context.step }),
      ...(context.planningErrors === undefined
        ? {}
        : { planningErrors: Object.freeze([...context.planningErrors]) }),
    });
  }
}
