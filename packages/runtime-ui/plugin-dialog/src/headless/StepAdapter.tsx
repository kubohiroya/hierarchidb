import type React from 'react';
import { useState, useEffect } from 'react';
import type { PluginStepConfig } from '../registry/PluginStepRegistry.js';

interface StepAdapterProps {
  cfg: PluginStepConfig;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  data: Record<string, unknown> | undefined;
  updateWorkingCopy: (patch: { data: Record<string, unknown> }) => void;
}

export const StepAdapter: React.FC<StepAdapterProps> = ({
                                                          cfg,
                                                          mode,
                                                          nodeId,
                                                          parentId,
                                                          data,
                                                          updateWorkingCopy,
                                                        }) => {
  const [, setValid] = useState<boolean | undefined>();
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof cfg.validate === 'function') {
      Promise.resolve(cfg.validate()).then(res => setValid(!!res)).catch(() => setValid(false));
    }
  }, [cfg]);

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data,
        onChange: (data: unknown) => updateWorkingCopy({ data: data as Record<string, unknown> }),
        setValid,
        setError,
      })}
    </>
  );
};
