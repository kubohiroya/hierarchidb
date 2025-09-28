import type { ComponentType, ReactNode } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';

export declare function getMuiIconComponent(name?: string, emoji?: string): ReactNode;
export declare function toPascalCase(value?: string): string;
export declare function prefetchMuiIcons(names: Array<string | undefined | null>): Promise<void>;
export declare function setGlobalMuiIconMap(map: Record<string, ComponentType<SvgIconProps>>): void;
export declare function getMuiIconWithColor(name?: string, emoji?: string, color?: string): ReactNode;
