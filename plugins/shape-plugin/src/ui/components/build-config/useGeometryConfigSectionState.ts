// Container logic for GeometryConfigSection.

import { getBuildConfigHoverCardSx } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { SxProps, Theme } from '@mui/material';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import type { ShapeBuildConfig, ShapeBuildGeometryConfig } from '~/common/types/index';
import { useGeometryConfigSection } from '~/ui/hooks/useGeometryConfigSection';
import { useGeometryConfigSectionView } from './useGeometryConfigSectionView.js';

interface GeometryConfigSectionStateProps {
    readonly config: ShapeBuildConfig;
    readonly onChange: (
        next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)
    ) => void;
    readonly disabled?: boolean;
    readonly disableHoverLift?: boolean;
}

export interface GeometryConfigSectionViewProps {
    readonly t: TFunction;
    readonly disabled: boolean;
    readonly disableHoverLift: boolean;
    readonly hoverCardSx: SxProps<Theme>;
    readonly baseGeometryConfig: ShapeBuildGeometryConfig;
    readonly simplifyAlgorithm: 'topojson' | 'geojson';
    readonly preserveTopology: boolean;
    readonly summaryHelp: string;
    readonly handleSimplifyAlgorithmChange: (_event: unknown, value: string) => void;
    readonly handlePreserveTopologyChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly onGeometryUpdate: (partial: Partial<ShapeBuildGeometryConfig>) => void;
}

export function useGeometryConfigSectionState(
    props: GeometryConfigSectionStateProps
): GeometryConfigSectionViewProps {
    const { config, onChange, disabled = false, disableHoverLift = false } = props;
    const { t } = useTranslation('shape-plugin');
    const { baseGeometryConfig, update } = useGeometryConfigSection({ config, onChange });

    const hoverCardSx = useMemo(
        () => getBuildConfigHoverCardSx(disabled, disableHoverLift),
        [disabled, disableHoverLift]
    );

    const simplifyAlgorithm = baseGeometryConfig.simplifyAlgorithm ?? 'topojson';
    const preserveTopology = baseGeometryConfig.preserveTopology ?? true;

    const { summaryHelp, handleSimplifyAlgorithmChange, handlePreserveTopologyChange } =
        useGeometryConfigSectionView({
            simplifyAlgorithm,
            preserveTopology,
            update: (partial) => update({ geometryConfig: partial }),
        });

    const onGeometryUpdate = (partial: Partial<ShapeBuildGeometryConfig>) =>
        update({ geometryConfig: partial });

    return {
        t,
        disabled,
        disableHoverLift,
        hoverCardSx,
        baseGeometryConfig,
        simplifyAlgorithm,
        preserveTopology,
        summaryHelp,
        handleSimplifyAlgorithmChange,
        handlePreserveTopologyChange,
        onGeometryUpdate,
    };
}
