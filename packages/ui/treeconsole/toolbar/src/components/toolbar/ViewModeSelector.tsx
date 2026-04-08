import { useCallback, useState } from 'react';
import { Button, ButtonGroup, IconButton, useMediaQuery } from '@mui/material';
import {
    Apps as IconViewIcon,
    FormatListBulleted as ListViewIcon,
    ViewColumn as ColumnViewIcon,
} from '@mui/icons-material';
import { SelectedMenu } from './SelectedMenu.js';
import type { SelectedMenuItem } from './SelectedMenu.js';

export type ViewMode = 'icon' | 'list' | 'column';

const VIEW_MODES: { value: ViewMode; label: string; icon: React.ReactElement }[] = [
    { value: 'icon', label: 'Icon', icon: <IconViewIcon fontSize="small" /> },
    { value: 'list', label: 'List', icon: <ListViewIcon fontSize="small" /> },
    { value: 'column', label: 'Column', icon: <ColumnViewIcon fontSize="small" /> },
];

const VIEW_MENU_ITEMS: readonly SelectedMenuItem<ViewMode>[] = VIEW_MODES.map((m) => ({
    value: m.value,
    label: m.label,
    icon: m.icon,
}));

export interface ViewModeSelectorProps {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    breakpoint?: number;
    forceWide?: boolean;
    /** When true, show only the icon without label text in compact mode. */
    iconOnly?: boolean;
}

export function ViewModeSelector({ value, onChange, breakpoint = 900, forceWide, iconOnly = false }: ViewModeSelectorProps) {
    const mediaWide = useMediaQuery(`(min-width:${breakpoint}px)`);
    const isWide = forceWide ?? mediaWide;

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(e.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    if (isWide) {
        return (
            <ButtonGroup size="small" variant="outlined" aria-label="View mode">
                {VIEW_MODES.map((mode) => (
                    <Button
                        key={mode.value}
                        startIcon={mode.icon}
                        onClick={() => onChange(mode.value)}
                        variant={value === mode.value ? 'contained' : 'outlined'}
                        aria-label={`${mode.label} view`}
                    >
                        {mode.label}
                    </Button>
                ))}
            </ButtonGroup>
        );
    }

    const current = VIEW_MODES.find((m) => m.value === value);
    return (
        <>
            {iconOnly ? (
                <IconButton
                    onClick={handleOpen}
                    aria-label="View mode"
                    size="small"
                >
                    {current?.icon}
                </IconButton>
            ) : (
                <Button
                    onClick={handleOpen}
                    aria-label="View mode"
                    size="small"
                    variant="outlined"
                    startIcon={current?.icon}
                >
                    {current?.label}
                </Button>
            )}
            <SelectedMenu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                items={VIEW_MENU_ITEMS}
                selectedValue={value}
                onSelect={onChange}
            />
        </>
    );
}
