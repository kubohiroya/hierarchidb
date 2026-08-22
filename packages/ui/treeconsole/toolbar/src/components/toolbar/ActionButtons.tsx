import {
  Delete as ArchiveIcon,
  Clear as ClearIcon,
  ContentCopy as ContentCopyIcon,
  ContentCut as ContentCutIcon,
  ContentPaste as ContentPasteIcon,
  FileCopy as DuplicateIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Redo as RedoIcon,
  ContentCut as ScissorsIcon,
  Undo as UndoIcon,
} from '@mui/icons-material';
import {
  Button,
  ButtonGroup,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import type { MouseEvent } from 'react';
import { useCallback, useState } from 'react';

export interface ActionButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  allowArchive: boolean;
  archiveButtonLabel: string;
  hasArchiveItems: boolean;
  onAction: (action: string) => void;
  onArchiveClick: (event: MouseEvent<HTMLElement>) => void;
  tooltips: {
    undo: string;
    redo: string;
    cut: string;
    copy: string;
    paste: string;
    duplicate: string;
    moveToArchive: string;
  };
  /** Responsive layout tier: wide = all buttons, medium = menu with label, narrow = icon-only menu */
  layout?: 'wide' | 'medium' | 'narrow';
}

export function ActionButtons({
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  allowArchive,
  archiveButtonLabel,
  hasArchiveItems,
  onAction,
  onArchiveClick,
  tooltips,
  layout = 'wide',
}: ActionButtonsProps) {
  if (layout === 'wide') {
    return (
      <WideActionButtons
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        canPaste={canPaste}
        canDuplicate={canDuplicate}
        allowArchive={allowArchive}
        archiveButtonLabel={archiveButtonLabel}
        hasArchiveItems={hasArchiveItems}
        onAction={onAction}
        onArchiveClick={onArchiveClick}
        tooltips={tooltips}
      />
    );
  }

  return (
    <CompactActionButtons
      canUndo={canUndo}
      canRedo={canRedo}
      canCopy={canCopy}
      canPaste={canPaste}
      canDuplicate={canDuplicate}
      allowArchive={allowArchive}
      archiveButtonLabel={archiveButtonLabel}
      hasArchiveItems={hasArchiveItems}
      onAction={onAction}
      onArchiveClick={onArchiveClick}
      tooltips={tooltips}
      showLabel={layout === 'medium'}
    />
  );
}

// -- Wide layout: all buttons visible --

type WideProps = Omit<ActionButtonsProps, 'layout'>;

function WideActionButtons({
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  allowArchive,
  archiveButtonLabel,
  hasArchiveItems,
  onAction,
  onArchiveClick,
  tooltips,
}: WideProps) {
  return (
    <>
      <ButtonGroup size="small">
        <Button
          title={tooltips.undo}
          aria-label={tooltips.undo}
          disabled={!canUndo}
          onClick={() => onAction('undo')}
          data-testid="treeconsole-toolbar-undo-button"
        >
          <UndoIcon fontSize="small" />
        </Button>
        <Button
          title={tooltips.redo}
          aria-label={tooltips.redo}
          disabled={!canRedo}
          onClick={() => onAction('redo')}
          data-testid="treeconsole-toolbar-redo-button"
        >
          <RedoIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      <ButtonGroup size="small">
        <Button
          title={tooltips.cut}
          aria-label={tooltips.cut}
          disabled={!canCopy}
          onClick={() => onAction('cut')}
        >
          <ContentCutIcon fontSize="small" />
        </Button>
        <Button
          title={tooltips.copy}
          aria-label={tooltips.copy}
          disabled={!canCopy}
          onClick={() => onAction('copy')}
        >
          <ContentCopyIcon fontSize="small" />
        </Button>
        <Button
          title={tooltips.paste}
          aria-label={tooltips.paste}
          disabled={!canPaste}
          onClick={() => onAction('paste')}
        >
          <ContentPasteIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      <ButtonGroup size="small">
        <Button
          title={tooltips.duplicate}
          aria-label={tooltips.duplicate}
          disabled={!canDuplicate}
          onClick={() => onAction('duplicate')}
        >
          <DuplicateIcon fontSize="small" />
        </Button>
        <Button
          title={tooltips.moveToArchive}
          aria-label={tooltips.moveToArchive}
          disabled={!allowArchive}
          onClick={() => onAction('archive')}
          color="error"
        >
          <ClearIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      <ButtonGroup size="small">
        <Button
          disabled={!hasArchiveItems}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={onArchiveClick}
          color="error"
          title={archiveButtonLabel}
          aria-label={archiveButtonLabel}
        >
          <ArchiveIcon fontSize="small" />
        </Button>
      </ButtonGroup>
    </>
  );
}

// -- Compact layout: single button that opens a menu --

interface CompactProps extends Omit<ActionButtonsProps, 'layout'> {
  showLabel: boolean;
}

function CompactActionButtons({
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  allowArchive,
  archiveButtonLabel,
  hasArchiveItems,
  onAction,
  onArchiveClick,
  tooltips,
  showLabel,
}: CompactProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((e: MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleMenuAction = useCallback(
    (action: string) => {
      onAction(action);
      handleClose();
    },
    [onAction, handleClose]
  );

  const handleArchiveMenuClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      handleClose();
      onArchiveClick(e);
    },
    [onArchiveClick, handleClose]
  );

  return (
    <>
      {showLabel ? (
        <Button
          size="small"
          variant="outlined"
          startIcon={<ScissorsIcon fontSize="small" />}
          onClick={handleOpen}
          aria-label="More actions"
        >
          More actions
        </Button>
      ) : (
        <IconButton size="small" onClick={handleOpen} aria-label="More actions">
          <ScissorsIcon fontSize="small" />
        </IconButton>
      )}
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem disabled={!canUndo} onClick={() => handleMenuAction('undo')}>
          <ListItemIcon>
            <UndoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.undo}</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canRedo} onClick={() => handleMenuAction('redo')}>
          <ListItemIcon>
            <RedoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.redo}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled={!canCopy} onClick={() => handleMenuAction('cut')}>
          <ListItemIcon>
            <ContentCutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.cut}</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canCopy} onClick={() => handleMenuAction('copy')}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.copy}</ListItemText>
        </MenuItem>
        <MenuItem disabled={!canPaste} onClick={() => handleMenuAction('paste')}>
          <ListItemIcon>
            <ContentPasteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.paste}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled={!canDuplicate} onClick={() => handleMenuAction('duplicate')}>
          <ListItemIcon>
            <DuplicateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{tooltips.duplicate}</ListItemText>
        </MenuItem>
        <MenuItem disabled={!allowArchive} onClick={() => handleMenuAction('archive')}>
          <ListItemIcon>
            <ClearIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{tooltips.moveToArchive}</ListItemText>
        </MenuItem>
        {hasArchiveItems && (
          <>
            <Divider />
            <MenuItem onClick={handleArchiveMenuClick}>
              <ListItemIcon>
                <ArchiveIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>{archiveButtonLabel}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
}
