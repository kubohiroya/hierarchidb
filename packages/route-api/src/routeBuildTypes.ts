export type RouteBuildError = {
  id: string;
  stage: 'source' | 'geometry' | 'tileEmit';
  message: string;
  sourceKey?: string;
  featureId?: string;
  createdAt: number;
};
