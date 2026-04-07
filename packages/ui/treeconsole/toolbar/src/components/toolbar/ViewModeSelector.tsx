import { useCallback, useState } from 'react';
import { Button, ToggleButton, ToggleButtonGroup, useMediaQuery } from '@mui/material';
import {
    Apps as IconViewIcon,
    FormatListBulleted as ListViewIcon,
    ViewColumn as ColumnViewIcon,
} from '@mui/icons-material';
import { SelectedMenu } from './SelectedMenu.js';
import type { SelectedMenuItem } from './SelectedMenu.js';

export type ViewMode = 'icon' | 'list' | 'column';

const VIEW_MODE_ICONS: Record<ViewMode, React.ReactElement> = {
    icon: <IconViewIcon />,
    list: <ListViewIcon />,
    column: <ColumnViewIcon />,
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
    icon: 'Icon',
    list: 'List',
    column: 'Column',
};

const VIEW_MENU_ITEMS: readonly SelectedMenuItem<ViewMode>[] = [
    { value: 'icon', label: 'Icon', icon: <IconViewIcon fontSize="small" /> },
    { value: 'list', label: 'List', icon: <ListViewIcon fontSize="small" /> },
    { value: 'column', label: 'Column', icon: <ColumnViewIcon fontSize="small" /> },
];

export interface ViewModeSelectorProps {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    breakpoint?: number;
    forceWide?: boolean;
}

export function ViewModeSelector({ value, onChange, breakpoint = 600, forceWide }: ViewModeSelectorProps) {
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

    const handleToggle = useCallback(
        (_: React.MouseEvent<HTMLElement>, newValue: ViewMode | null) => {
            if (newValue !== null) {
                onChange(newValue);
            }
        },
        [onChange],
    );

    if (isWide) {
        return (
            <ToggleButtonGroup
                value={value}
                exclusive
                onChange={handleToggle}
                size="small"
                aria-label="View mode"
            >
                <ToggleButton value="icon" aria-label="Icon view">
                    <IconViewIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="list" aria-label="List view">
                    <ListViewIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="column" aria-label="Column view">
                    <ColumnViewIcon fontSize="small" />
                </ToggleButton>
            </ToggleButtonGroup>
        );
    }

    return (
        <>
            <Button
                onClick={handleOpen}
                aria-label="View mode"
                size="small"
                variant="outlined"
                startIcon={VIEW_MODE_ICONS[value]}
            >
                {VIEW_MODE_LABELS[value]}
            </Button>
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
