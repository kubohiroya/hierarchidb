import { canonicalYamlZipImportPlanProvenance } from './canonicalYamlZipImportPlanProvenance.internalConstants.js';
import type {
  CanonicalYamlZipImportTransactionPort,
  CommitCanonicalYamlZipImportPlanResult,
} from './canonicalYamlZipPlanTypes.js';

/** Commits an issued import plan through exactly one caller-owned atomic transaction port. */
export async function commitCanonicalYamlZipImportPlan(
  plan: unknown,
  transactionPort: unknown
): Promise<CommitCanonicalYamlZipImportPlanResult> {
  if (!canonicalYamlZipImportPlanProvenance.consume(plan)) {
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'INVALID_PLAN' }) });
  }
  if (typeof transactionPort !== 'function') {
    return Object.freeze({ ok: false, error: Object.freeze({ code: 'INVALID_PLAN' }) });
  }
  try {
    await (transactionPort as CanonicalYamlZipImportTransactionPort)(plan.request);
    return Object.freeze({ ok: true });
  } catch {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'TRANSACTION_PORT_FAILED' }),
    });
  }
}
