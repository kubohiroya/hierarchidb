import type React from 'react';
import { type ReactNode } from 'react';
export type MenuItemLinkType = {
    name: string;
    icon: ReactNode;
    url: string;
};
export declare const MenuListItemLinkButton: ({ id, items, }: {
    id: string;
    items: Array<MenuItemLinkType | null>;
}) => React.ReactElement;
//# sourceMappingURL=MenuListItemLinkButton.d.ts.map