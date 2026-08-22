import { type MouseEvent as ReactMouseEvent, useMemo, useState } from 'react';
import type {
  IdeGsmFileEntry,
  IdeGsmImportPanelProps,
  IdeGsmImportPayload,
} from './IdeGsmImportPanel.js';

interface UseIdeGsmImportPanelArgs {
  props: IdeGsmImportPanelProps;
  labels: IdeGsmImportPanelProps['labels'];
}

export const useIdeGsmImportPanel = ({ props, labels }: UseIdeGsmImportPanelArgs) => {
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [lastAction, setLastAction] = useState<'local' | 'remote'>('local');
  const menuOpen = Boolean(menuAnchor);
  const isMulti = 'files' in props;

  const files = useMemo<IdeGsmFileEntry[]>(() => {
    if (isMulti) {
      return props.files;
    }
    if (props.fileName || props.sourceId) {
      const sourceId = props.sourceId ?? '';
      return [
        {
          fileName: props.fileName ?? labels.fileFallback,
          sourceId,
          sourceType: 'local',
          sizeBytes: props.sizeBytes,
        },
      ];
    }
    return [];
  }, [isMulti, labels.fileFallback, props]);

  const closeDialogs = () => {
    setLocalDialogOpen(false);
    setRemoteDialogOpen(false);
  };

  const handleFileSelect = async (file: File, downloadUrl?: string) => {
    const sourceType: IdeGsmImportPayload['sourceType'] = downloadUrl ? 'remote' : 'local';
    if (isMulti) {
      props.onAddFile({
        file,
        downloadUrl,
        sourceType,
      });
    } else {
      props.onChange({
        file,
        downloadUrl,
        sourceType,
      });
    }
    closeDialogs();
  };

  const handleRemove = (event: ReactMouseEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (isMulti) {
      try {
        props.onRemoveFile(index);
      } catch (error) {
        console.log('onRemoveFile error', error);
      }
    } else {
      props.onClear();
    }
  };

  const handlePrimaryButtonClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    event.stopPropagation();
    if (lastAction === 'remote') {
      setRemoteDialogOpen(true);
      return;
    }
    setLocalDialogOpen(true);
  };

  const handleMenuButtonClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.currentTarget.blur();
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleSelectLocal = () => {
    menuAnchor?.blur();
    setMenuAnchor(null);
    setLastAction('local');
    setLocalDialogOpen(true);
  };

  const handleSelectRemote = () => {
    menuAnchor?.blur();
    setMenuAnchor(null);
    setLastAction('remote');
    setRemoteDialogOpen(true);
  };

  const mainButtonLabel = lastAction === 'remote' ? labels.importRemote : labels.importLocal;

  return {
    localDialogOpen,
    remoteDialogOpen,
    menuAnchor,
    menuOpen,
    files,
    mainButtonLabel,
    handleFileSelect,
    handleRemove,
    handlePrimaryButtonClick,
    handleMenuButtonClick,
    handleSelectLocal,
    handleSelectRemote,
    setLocalDialogOpen,
    setRemoteDialogOpen,
    setMenuAnchor,
  };
};
