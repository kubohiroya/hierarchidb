import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';

interface ClearDatabaseDialogProps {
  open: boolean;
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ClearDatabaseDialog: React.FC<ClearDatabaseDialogProps> = ({
  open,
  titleId,
  descriptionId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation('common');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <DialogTitle id={titleId}>{t('userMenu.clear.title', 'Clear all data?')}</DialogTitle>
      <DialogContent>
        <DialogContentText id={descriptionId} component="div">
          {t('userMenu.clear.description', 'This will clear all data including:')}
        </DialogContentText>
        <List dense sx={{ pl: 1 }}>
          <ListItem>
            <ListItemText primary={t('userMenu.clear.items.cache', 'Cache API data')} />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={t(
                'userMenu.clear.items.indexedDb',
                'All IndexedDB databases (projects, maps, shapes, etc.)'
              )}
            />
          </ListItem>
          <ListItem>
            <ListItemText primary={t('userMenu.clear.items.localStorage', 'localStorage data')} />
          </ListItem>
        </List>
        <DialogContentText component="div" sx={{ mt: 1 }}>
          {t(
            'userMenu.clear.warning',
            'This action cannot be undone and will delete all your local data. The page will reload after clearing the cache.'
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('userMenu.clear.cancel', 'Cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained" autoFocus>
          {t('userMenu.clear.confirm', 'Clear All Data')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
