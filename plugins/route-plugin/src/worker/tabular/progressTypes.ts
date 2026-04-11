export type ProgressReporter = (progress: {
  stage: string;
  completed?: number;
  total?: number;
  updatedAt?: number;
}) => void;
