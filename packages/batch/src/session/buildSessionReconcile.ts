export type MetadataDescriptor = {
  key: string;
  meta?: string;
  updatedAt?: number;
};

export type ReconcileResult = {
  create: string[];
  update: string[];
  remove: string[];
};

const shouldUpdate = (source: MetadataDescriptor, artifact: MetadataDescriptor): boolean => {
  const sourceMeta = source.meta;
  const artifactMeta = artifact.meta;
  if (sourceMeta !== undefined || artifactMeta !== undefined) {
    if (sourceMeta === undefined || artifactMeta === undefined) {
      return true;
    }
    return sourceMeta !== artifactMeta;
  }
  const sourceUpdatedAt = source.updatedAt;
  const artifactUpdatedAt = artifact.updatedAt;
  if (sourceUpdatedAt === undefined && artifactUpdatedAt === undefined) {
    return false;
  }
  if (sourceUpdatedAt === undefined) {
    return false;
  }
  if (artifactUpdatedAt === undefined) {
    return true;
  }
  return artifactUpdatedAt < sourceUpdatedAt;
};

export const reconcileByMetadata = (
  sources: MetadataDescriptor[],
  artifacts: MetadataDescriptor[],
): ReconcileResult => {
  const sourceByKey = new Map(sources.map((source) => [source.key, source] as const));
  const artifactByKey = new Map(artifacts.map((artifact) => [artifact.key, artifact] as const));

  const create: string[] = [];
  const update: string[] = [];
  const remove: string[] = [];

  sources.forEach((source) => {
    const artifact = artifactByKey.get(source.key);
    if (!artifact) {
      create.push(source.key);
      return;
    }
    if (shouldUpdate(source, artifact)) {
      update.push(source.key);
    }
  });

  artifacts.forEach((artifact) => {
    if (!sourceByKey.has(artifact.key)) {
      remove.push(artifact.key);
    }
  });

  create.sort();
  update.sort();
  remove.sort();

  return { create, update, remove };
};
