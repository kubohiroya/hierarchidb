import { validateExternalServiceConnectionDraft } from '@hierarchidb/ui-external-service-connection';
import type {
  IdeGsmConnectionDraft,
  IdeGsmConnectionRuntimeProvider,
  IdeGsmConnectionValidationResult,
} from './ideGsmConnectionTypes.js';

export async function validateIdeGsmConnectionDraft(
  draft: IdeGsmConnectionDraft,
  provider: IdeGsmConnectionRuntimeProvider
): Promise<IdeGsmConnectionValidationResult> {
  return validateExternalServiceConnectionDraft(draft, provider);
}
