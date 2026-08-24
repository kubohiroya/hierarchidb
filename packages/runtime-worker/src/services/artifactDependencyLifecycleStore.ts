import type { DependencyEdgeStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import Dexie, { type Table } from 'dexie';

export type ArtifactDependencyEdgeRecord = {
  edgeId: string;
  artifactId: string;
  artifactType: string;
  buildTargetNodeId: NodeId;
  sourceNodeId: NodeId;
  sourceFieldPath?: string;
  targetNodeId: NodeId;
  targetFieldPath: string;
  status: DependencyEdgeStatus;
  buildSessionId?: string;
  mountId?: string;
  createdAt: number;
  updatedAt: number;
  staleAt?: number;
  rebuildingAt?: number;
  resolvedAt?: number;
  orphanedAt?: number;
  replacedByEdgeId?: string;
  orphanReason?: ArtifactDependencyOrphanReason;
};

export type ArtifactDependencyOrphanReason =
  | 'artifact-missing'
  | 'source-node-missing'
  | 'target-node-missing'
  | 'mount-missing';

export type CreateArtifactDependencyEdgeInput = {
  edgeId: string;
  artifactId: string;
  artifactType: string;
  buildTargetNodeId: NodeId;
  sourceNodeId: NodeId;
  sourceFieldPath?: string;
  targetNodeId: NodeId;
  targetFieldPath: string;
  buildSessionId?: string;
  mountId?: string;
};

export type MarkArtifactDependenciesStaleInput = {
  targetNodeId: NodeId;
  targetFieldPath?: string;
  now: number;
};

export type MarkArtifactDependenciesRebuildingInput = {
  edgeIds: readonly string[];
  buildTargetNodeId: NodeId;
  buildSessionId: string;
  now: number;
};

export type ResolveArtifactDependenciesInput = {
  edgeIds: readonly string[];
  replacementEdges: readonly CreateArtifactDependencyEdgeInput[];
  now: number;
};

export type DetectArtifactDependencyOrphansInput = {
  existingArtifactIds: ReadonlySet<string>;
  existingNodeIds: ReadonlySet<NodeId>;
  existingMountIds?: ReadonlySet<string>;
  now: number;
};

export type ArtifactDependencyOrphanDetectionResult = {
  updatedEdges: readonly ArtifactDependencyEdgeRecord[];
};

const artifactDependencyEdgeStatuses: readonly DependencyEdgeStatus[] = [
  'active',
  'stale',
  'rebuilding',
  'resolved',
  'orphaned',
];

const activeLifecycleStatuses = new Set<DependencyEdgeStatus>(['active', 'stale', 'rebuilding']);

export class ArtifactDependencyLifecycleStore extends Dexie {
  artifactDependencyEdges!: Table<ArtifactDependencyEdgeRecord, string>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      artifactDependencyEdges: [
        '&edgeId',
        'status',
        'artifactId',
        'buildTargetNodeId',
        'sourceNodeId',
        'targetNodeId',
        'targetFieldPath',
        '[targetNodeId+targetFieldPath]',
        'mountId',
        'updatedAt',
      ].join(', '),
    });
  }

  async recordActiveEdges(
    edges: readonly CreateArtifactDependencyEdgeInput[],
    now: number
  ): Promise<ArtifactDependencyEdgeRecord[]> {
    assertTimestamp(now, 'now');
    if (edges.length === 0) {
      throw new Error('edges must include at least one dependency edge.');
    }
    const records = edges.map((edge, index) =>
      createActiveEdgeRecord(edge, now, `edges[${index}]`)
    );
    await this.transaction('rw', this.artifactDependencyEdges, async () => {
      await this.artifactDependencyEdges.bulkAdd(records);
    });
    return records;
  }

  async markStaleByTarget(
    input: MarkArtifactDependenciesStaleInput
  ): Promise<ArtifactDependencyEdgeRecord[]> {
    assertNodeId(input.targetNodeId, 'targetNodeId');
    if (input.targetFieldPath !== undefined) {
      assertFieldPath(input.targetFieldPath, 'targetFieldPath');
    }
    assertTimestamp(input.now, 'now');

    return await this.transaction('rw', this.artifactDependencyEdges, async () => {
      const candidates =
        input.targetFieldPath === undefined
          ? await this.artifactDependencyEdges
              .where('targetNodeId')
              .equals(input.targetNodeId)
              .toArray()
          : await this.artifactDependencyEdges
              .where('[targetNodeId+targetFieldPath]')
              .equals([input.targetNodeId, input.targetFieldPath])
              .toArray();
      const staleEdges = candidates
        .filter((edge) => edge.status === 'active')
        .map((edge) => ({
          ...edge,
          status: 'stale' as const,
          staleAt: input.now,
          updatedAt: input.now,
        }));
      await this.artifactDependencyEdges.bulkPut(staleEdges);
      return staleEdges;
    });
  }

  async markRebuilding(
    input: MarkArtifactDependenciesRebuildingInput
  ): Promise<ArtifactDependencyEdgeRecord[]> {
    assertNodeId(input.buildTargetNodeId, 'buildTargetNodeId');
    assertNonEmptyString(input.buildSessionId, 'buildSessionId');
    assertTimestamp(input.now, 'now');
    assertEdgeIds(input.edgeIds);

    return await this.transaction('rw', this.artifactDependencyEdges, async () => {
      const edges = await this.artifactDependencyEdges.bulkGet([...input.edgeIds]);
      const records = edges.map((edge, index) => {
        if (edge === undefined) {
          throw new Error(`edgeIds[${index}] was not found.`);
        }
        if (edge.status !== 'stale') {
          throw new Error(`edgeIds[${index}] must reference a stale edge.`);
        }
        if (edge.buildTargetNodeId !== input.buildTargetNodeId) {
          throw new Error(`edgeIds[${index}] does not belong to buildTargetNodeId.`);
        }
        return {
          ...edge,
          status: 'rebuilding' as const,
          buildSessionId: input.buildSessionId,
          rebuildingAt: input.now,
          updatedAt: input.now,
        };
      });
      await this.artifactDependencyEdges.bulkPut(records);
      return records;
    });
  }

  async resolveEdges(input: ResolveArtifactDependenciesInput): Promise<{
    resolvedEdges: ArtifactDependencyEdgeRecord[];
    activeEdges: ArtifactDependencyEdgeRecord[];
  }> {
    assertTimestamp(input.now, 'now');
    assertEdgeIds(input.edgeIds);
    if (input.replacementEdges.length === 0) {
      throw new Error('replacementEdges must include at least one active replacement edge.');
    }
    const replacementRecords = input.replacementEdges.map((edge, index) =>
      createActiveEdgeRecord(edge, input.now, `replacementEdges[${index}]`)
    );

    return await this.transaction('rw', this.artifactDependencyEdges, async () => {
      const edges = await this.artifactDependencyEdges.bulkGet([...input.edgeIds]);
      const resolvedEdges = edges.map((edge, index) => {
        if (edge === undefined) {
          throw new Error(`edgeIds[${index}] was not found.`);
        }
        if (edge.status !== 'stale' && edge.status !== 'rebuilding') {
          throw new Error(`edgeIds[${index}] must reference a stale or rebuilding edge.`);
        }
        const replacement = replacementRecords.find(
          (record) =>
            record.artifactId === edge.artifactId &&
            record.buildTargetNodeId === edge.buildTargetNodeId
        );
        if (replacement === undefined) {
          throw new Error(
            `edgeIds[${index}] has no replacement edge for the same artifact target.`
          );
        }
        return {
          ...edge,
          status: 'resolved' as const,
          resolvedAt: input.now,
          replacedByEdgeId: replacement.edgeId,
          updatedAt: input.now,
        };
      });
      await this.artifactDependencyEdges.bulkPut([...resolvedEdges, ...replacementRecords]);
      return {
        resolvedEdges,
        activeEdges: replacementRecords,
      };
    });
  }

  async detectOrphans(
    input: DetectArtifactDependencyOrphansInput
  ): Promise<ArtifactDependencyOrphanDetectionResult> {
    assertTimestamp(input.now, 'now');

    return await this.transaction('rw', this.artifactDependencyEdges, async () => {
      const edges = await this.artifactDependencyEdges.toArray();
      const updatedEdges: ArtifactDependencyEdgeRecord[] = [];
      edges
        .filter((edge) => activeLifecycleStatuses.has(edge.status))
        .forEach((edge) => {
          const orphanReason = detectOrphanReason(edge, input);
          if (orphanReason === null) return;
          updatedEdges.push({
            ...edge,
            status: 'orphaned' as const,
            orphanReason,
            orphanedAt: input.now,
            updatedAt: input.now,
          });
        });
      await this.artifactDependencyEdges.bulkPut(updatedEdges);
      return { updatedEdges };
    });
  }

  async listEdgesByStatus(status: DependencyEdgeStatus): Promise<ArtifactDependencyEdgeRecord[]> {
    assertDependencyEdgeStatus(status, 'status');
    return await this.artifactDependencyEdges.where('status').equals(status).toArray();
  }

  async listEdgesForTarget(
    targetNodeId: NodeId,
    targetFieldPath?: string
  ): Promise<ArtifactDependencyEdgeRecord[]> {
    assertNodeId(targetNodeId, 'targetNodeId');
    if (targetFieldPath !== undefined) {
      assertFieldPath(targetFieldPath, 'targetFieldPath');
      return await this.artifactDependencyEdges
        .where('[targetNodeId+targetFieldPath]')
        .equals([targetNodeId, targetFieldPath])
        .toArray();
    }
    return await this.artifactDependencyEdges.where('targetNodeId').equals(targetNodeId).toArray();
  }
}

const createActiveEdgeRecord = (
  input: CreateArtifactDependencyEdgeInput,
  now: number,
  path: string
): ArtifactDependencyEdgeRecord => {
  assertNonEmptyString(input.edgeId, `${path}.edgeId`);
  assertNonEmptyString(input.artifactId, `${path}.artifactId`);
  assertNonEmptyString(input.artifactType, `${path}.artifactType`);
  assertNodeId(input.buildTargetNodeId, `${path}.buildTargetNodeId`);
  assertNodeId(input.sourceNodeId, `${path}.sourceNodeId`);
  if (input.sourceFieldPath !== undefined) {
    assertFieldPath(input.sourceFieldPath, `${path}.sourceFieldPath`);
  }
  assertNodeId(input.targetNodeId, `${path}.targetNodeId`);
  assertFieldPath(input.targetFieldPath, `${path}.targetFieldPath`);
  if (input.buildSessionId !== undefined) {
    assertNonEmptyString(input.buildSessionId, `${path}.buildSessionId`);
  }
  if (input.mountId !== undefined) {
    assertNonEmptyString(input.mountId, `${path}.mountId`);
  }
  return {
    ...input,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
};

const detectOrphanReason = (
  edge: ArtifactDependencyEdgeRecord,
  input: DetectArtifactDependencyOrphansInput
): ArtifactDependencyOrphanReason | null => {
  if (!input.existingArtifactIds.has(edge.artifactId)) return 'artifact-missing';
  if (!input.existingNodeIds.has(edge.sourceNodeId)) return 'source-node-missing';
  if (!input.existingNodeIds.has(edge.targetNodeId)) return 'target-node-missing';
  if (
    edge.mountId !== undefined &&
    input.existingMountIds !== undefined &&
    !input.existingMountIds.has(edge.mountId)
  ) {
    return 'mount-missing';
  }
  return null;
};

const assertEdgeIds = (edgeIds: readonly string[]): void => {
  if (edgeIds.length === 0) {
    throw new Error('edgeIds must include at least one edge id.');
  }
  edgeIds.forEach((edgeId, index) => {
    assertNonEmptyString(edgeId, `edgeIds[${index}]`);
  });
};

const assertDependencyEdgeStatus = (status: DependencyEdgeStatus, path: string): void => {
  if (!artifactDependencyEdgeStatuses.includes(status)) {
    throw new Error(`${path} must be a valid dependency edge status.`);
  }
};

const assertFieldPath = (fieldPath: string, path: string): void => {
  assertNonEmptyString(fieldPath, path);
  if (fieldPath.includes('..')) {
    throw new Error(`${path} must not contain parent traversal.`);
  }
};

const assertNodeId = (nodeId: NodeId, path: string): void => {
  assertNonEmptyString(nodeId, path);
};

const assertNonEmptyString = (value: string, path: string): void => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
};

const assertTimestamp = (value: number, path: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a finite non-negative number.`);
  }
};
