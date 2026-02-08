type RecordShape = Record<string, unknown>;

export const sanitizeShapeDraftData = <T extends RecordShape>(data: T | null | undefined): T => {
  if (!data || typeof data !== 'object') {
    return {} as T;
  }
  const { name, description, tags, ...rest } = data as RecordShape;
  void name;
  void description;
  void tags;
  return rest as T;
};
