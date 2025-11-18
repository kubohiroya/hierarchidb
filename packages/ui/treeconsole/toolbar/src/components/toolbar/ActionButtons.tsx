import {
  ContentCopy as ContentCopyIcon,
  ContentCut as ContentCutIcon,
  ContentPaste as ContentPasteIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Redo as RedoIcon,
  Trash as TrashIcon,
  Undo as UndoIcon,
  FileCopy as DuplicateIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { Button, ButtonGroup } from '@mui/material';
import type { MouseEvent } from 'react';

export interface ActionButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDuplicate: boolean;
  allowTrash: boolean;
  trashButtonLabel: string;
  hasTrashItems: boolean;
  onAction: (action: string) => void;
  onTrashClick: (event: MouseEvent<HTMLElement>) => void;
  tooltips: {
    undo: string;
    redo: string;
    cut: string;
    copy: string;
    paste: string;
    duplicate: string;
    moveToTrash: string;
  };
}

export function ActionButtons({
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDuplicate,
  allowTrash,
  trashButtonLabel,
  hasTrashItems,
  onAction,
  onTrashClick,
  tooltips,
}: ActionButtonsProps) {
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
          title={tooltips.moveToTrash}
          aria-label={tooltips.moveToTrash}
          disabled={!allowTrash}
          onClick={() => onAction('trash')}
          color="error"
        >
          <ClearIcon fontSize="small" />
        </Button>
      </ButtonGroup>

      <ButtonGroup size="small">
        <Button
          disabled={!hasTrashItems}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={onTrashClick}
          color="error"
          title={trashButtonLabel}
          aria-label={trashButtonLabel}
        >
          <TrashIcon fontSize="small" />
        </Button>
      </ButtonGroup>
    </>
  );
}
