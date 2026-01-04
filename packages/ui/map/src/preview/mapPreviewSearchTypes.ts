export type MapSearchTargetDefinition = {
  label: string;
  group: 'point' | 'route' | 'shape';
  keys: string[];
};

export type MapSearchTargetGroup<T extends string> = {
  title: string;
  targetIds: T[];
};
