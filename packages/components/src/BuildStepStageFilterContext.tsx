import { createContext, useContext, type ReactNode } from 'react';

export type BuildStageFilter = {
  failedMode: boolean;
  completedMode: boolean;
  skippedMode: boolean;
};

const BuildStageFilterContext = createContext<BuildStageFilter>({
  failedMode: true,
  completedMode: true,
  skippedMode: true,
});

export const BuildStageFilterProvider = ({
  value,
  children,
}: {
  value: BuildStageFilter;
  children: ReactNode;
}) => (
  <BuildStageFilterContext.Provider value={value}>
    {children}
  </BuildStageFilterContext.Provider>
);

export const useBuildStageFilter = (): BuildStageFilter => (
  useContext(BuildStageFilterContext)
);
