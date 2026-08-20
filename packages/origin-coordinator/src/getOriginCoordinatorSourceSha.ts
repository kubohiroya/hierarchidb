import { isOriginCoordinatorReleaseId } from './censusProbeValidatorUtils.js';

declare const __SOURCE_SHA__: string;

export function getOriginCoordinatorSourceSha(): string {
  if (typeof __SOURCE_SHA__ !== 'undefined' && isOriginCoordinatorReleaseId(__SOURCE_SHA__)) {
    return __SOURCE_SHA__;
  }
  throw new Error('Exact build source SHA is unavailable.');
}
