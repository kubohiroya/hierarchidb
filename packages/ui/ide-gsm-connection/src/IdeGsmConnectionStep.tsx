import {
  createEmptyExternalServiceConnectionDraft,
  ExternalServiceConnectionStep,
} from '@hierarchidb/ui-external-service-connection';
import type { IdeGsmConnectionDraft, IdeGsmConnectionStepProps } from './ideGsmConnectionTypes.js';

export const createEmptyIdeGsmConnectionDraft = (): IdeGsmConnectionDraft =>
  createEmptyExternalServiceConnectionDraft();

export function IdeGsmConnectionStep(props: IdeGsmConnectionStepProps) {
  return <ExternalServiceConnectionStep {...props} />;
}
