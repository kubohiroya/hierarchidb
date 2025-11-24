export type BasicInfo = {
  name: string;
  description?: string;
  tags?: string[];
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

export function normalizeBasicInfo(input?: {
  metadata?: Record<string, unknown> | null;
  draftData?: Record<string, unknown> | null;
}): BasicInfo {
  const meta = (input?.metadata ?? {}) as Record<string, unknown>;
  const draft = (input?.draftData ?? {}) as Record<string, unknown>;
  const tags =
    toStringArray(meta.tags) ||
    toStringArray(draft.tags);

  const name =
    typeof draft.name === 'string'
      ? draft.name
      : typeof meta.name === 'string'
        ? meta.name
        : '';
  const description =
    typeof draft.description === 'string'
      ? draft.description
      : typeof meta.description === 'string'
        ? meta.description
        : undefined;

  return {
    name,
    description,
    tags: tags.length ? tags : undefined,
  };
}

export function mergeBasicInfo(current: BasicInfo, patch?: Partial<BasicInfo>): BasicInfo {
  return {
    name: patch?.name ?? current.name ?? '',
    description: patch?.description ?? current.description,
    tags: patch?.tags ?? current.tags,
  };
}
