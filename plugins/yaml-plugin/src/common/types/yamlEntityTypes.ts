import type { YamlFileNodeData, YamlSubtype } from '@hierarchidb/yaml-api';

export type YamlDraft = Partial<YamlFileNodeData> & {
  readonly subtype?: YamlSubtype;
};
