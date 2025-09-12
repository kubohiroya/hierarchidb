/**
 * @file DropdownMenu.tsx
 * @description A generic dropdown menu component that provides a clickable trigger element
 * with a popup menu of actions. Supports icon, dividers, and custom click handlers for
 * each menu item.
 *
 * @module components/ui/DropdownMenu
 *
 * @usage
 * - User avatar menus (UserAvatarMenu)
 * - Context menus for list items
 * - Action menus in toolbars and headers
 *
 * @dependencies
 * - @mui/material: Menu, MenuItem, Box, ListItemIcon, ListItemText containers
 * - React: hooks (useState, useCallback)
 * - DropdownMenuItemType: Menu item configuration type
 */
import { type ReactNode } from 'react';
import type { DropdownMenuItemType } from './DropdownMenuItemType';
export interface DropdownMenuProps {
    id: string;
    items: Array<DropdownMenuItemType | null>;
    disabled?: boolean;
    color?: string;
    children?: ReactNode;
}
export declare const DropdownMenu: ({ id, items, disabled, color, children, }: DropdownMenuProps) => JSX.Element;
//# sourceMappingURL=DropdownMenu.d.ts.map