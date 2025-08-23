export interface DropdownMenuItemType {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  divider?: boolean;
}
