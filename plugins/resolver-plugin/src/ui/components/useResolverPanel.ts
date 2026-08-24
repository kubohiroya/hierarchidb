import { useCallback, useEffect, useState } from 'react';
import type { ResolverEntity } from '~/common/entities/ResolverEntity';

interface MappingStatistics {
  totalSourceProperties: number;
  totalTargetProperties: number;
  mappedProperties: number;
  unmappedProperties: string[];
  coverage: number;
  conflicts: string[];
}

export function useResolverPanel(entity: ResolverEntity | undefined, onCompile?: () => void) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [compilationStatus, setCompilationStatus] = useState<
    'idle' | 'compiling' | 'compiled' | 'error'
  >('idle');
  const [statistics, setStatistics] = useState<MappingStatistics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (entity) {
      const totalMappings = entity.mappingRules.length;

      setStatistics({
        totalSourceProperties: 0,
        totalTargetProperties: 0,
        mappedProperties: totalMappings,
        unmappedProperties: [],
        coverage: totalMappings > 0 ? 100 : 0,
        conflicts: [],
      });

      if (totalMappings > 5) {
        setCompilationStatus('compiled');
      }
    }
  }, [entity]);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleCompile = useCallback(async () => {
    setIsProcessing(true);
    setCompilationStatus('compiling');

    setTimeout(() => {
      setCompilationStatus('compiled');
      setIsProcessing(false);
      onCompile?.();
    }, 2000);
  }, [onCompile]);

  return {
    anchorEl,
    compilationStatus,
    handleCompile,
    handleMenuClose,
    isProcessing,
    statistics,
  };
}
