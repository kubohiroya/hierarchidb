import { expectTypeOf, describe, it } from 'vitest';
import type { WorkerAPI } from '../WorkerAPI';
import type { TreeQueryAPI } from '../TreeQueryAPI';
import type { TreeMutationAPI } from '../TreeMutationAPI';
import type { TreeSubscriptionAPI } from '../TreeSubscriptionAPI';
import type { ImportExportAPI } from '../ImportExportAPI';
import type { TagAPI } from '../TagAPI';
import type { ProxyMarked } from 'comlink';

type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never;

describe('WorkerAPI type surface', () => {
  it('does not expose ProxyMarked in sub-API return types', () => {
    expectTypeOf<ReturnTypeOf<WorkerAPI['getQueryAPI']>>().toMatchTypeOf<TreeQueryAPI>();
    expectTypeOf<ReturnTypeOf<WorkerAPI['getQueryAPI']>>().not.toMatchTypeOf<ProxyMarked>();

    expectTypeOf<ReturnTypeOf<WorkerAPI['getMutationAPI']>>().toMatchTypeOf<TreeMutationAPI>();
    expectTypeOf<ReturnTypeOf<WorkerAPI['getMutationAPI']>>().not.toMatchTypeOf<ProxyMarked>();

    expectTypeOf<ReturnTypeOf<WorkerAPI['getSubscriptionAPI']>>().toMatchTypeOf<TreeSubscriptionAPI>();
    expectTypeOf<ReturnTypeOf<WorkerAPI['getSubscriptionAPI']>>().not.toMatchTypeOf<ProxyMarked>();

    expectTypeOf<ReturnTypeOf<WorkerAPI['getImportExportAPI']>>().toMatchTypeOf<ImportExportAPI>();
    expectTypeOf<ReturnTypeOf<WorkerAPI['getImportExportAPI']>>().not.toMatchTypeOf<ProxyMarked>();

    expectTypeOf<ReturnTypeOf<WorkerAPI['getTagAPI']>>().toMatchTypeOf<TagAPI>();
    expectTypeOf<ReturnTypeOf<WorkerAPI['getTagAPI']>>().not.toMatchTypeOf<ProxyMarked>();
  });
});
