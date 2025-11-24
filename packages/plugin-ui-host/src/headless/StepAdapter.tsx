import type { PluginStepConfig } from '@hierarchidb/plugin-base';
import type React from 'react';
import { useEffect, useState } from 'react';

interface StepAdapterProps {
  cfg: PluginStepConfig;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  data: Record<string, unknown> | undefined;
  updateDraft: (patch: { draftData: Record<string, unknown> }) => void;
}

export const StepAdapter: React.FC<StepAdapterProps> = ({
  cfg,
  mode,
  nodeId,
  parentId,
  data,
  updateDraft,
}) => {
  const [, setValid] = useState<boolean | undefined>();
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof cfg.validate === 'function') {
      Promise.resolve(cfg.validate())
        .then((res) => setValid(!!res))
        .catch(() => setValid(false));
    }
  }, [cfg]);

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data,
        onChange: (data: unknown) =>
          updateDraft({ draftData: data as Record<string, unknown> }),
        setValid,
        setError,
      })}
    </>
  );
};
