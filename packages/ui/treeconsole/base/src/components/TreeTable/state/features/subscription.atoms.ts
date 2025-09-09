/**
  * Subscription Feature Atoms
  * SubTreeatom
 * -
 * -
  */

import { atom } from 'jotai';

/**
  * SubTreeID
  */
export const subscribedRootNodeIdAtom = atom<string | null>(null);

/**
  * ID
  */
export const subscriptionIdAtom = atom<string | null>(null);

/**
    */
export const subscriptionDepthAtom = atom<number>(2);

/**
    */
export const lastUpdateTimestampAtom = atom<number>(0);

/**
    */
export const pendingUpdatesAtom = atom<any[]>([]);
