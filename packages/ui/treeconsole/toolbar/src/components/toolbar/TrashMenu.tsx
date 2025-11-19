import { DeleteForever as EmptyTrashIcon, RestoreFromTrash as RecyclingIcon } from '@mui/icons-material';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';

export interface TrashMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onRestore: () => void;
  onEmpty: () => void;
  restoreLabel: string;
  emptyLabel: string;
}

export function TrashMenu({
  anchorEl,
  open,
  onClose,
  onRestore,
  onEmpty,
  restoreLabel,
  emptyLabel,
}: TrashMenuProps) {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose} keepMounted>
      <MenuItem
        onClick={() => {
          onRestore();
          onClose();
        }}
        aria-label={restoreLabel}
      >
        <ListItemIcon>
          <RecyclingIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={restoreLabel} />
      </MenuItem>
      <MenuItem
        onClick={() => {
          onEmpty();
          onClose();
        }}
        aria-label={emptyLabel}
      >
        <ListItemIcon>
          <EmptyTrashIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={emptyLabel} />
      </MenuItem>
    </Menu>
  );
}
