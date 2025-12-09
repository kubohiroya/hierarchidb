import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

type ResumeDraftDialogProps = {
  open: boolean;
  nodeName: string;
  onCancel: () => void;
  onStartFresh: () => void | Promise<void>;
  onResumePrevious: () => void;
};

export function ResumeDraftDialog({
  open,
  nodeName,
  onCancel,
  onStartFresh,
  onResumePrevious,
}: ResumeDraftDialogProps): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t('dialogs.pluginDraft.resume.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{t('dialogs.pluginDraft.resume.description')}</Typography>
        {nodeName ? (
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            {nodeName}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('dialogs.pluginDraft.resume.buttons.cancel')}</Button>
        <Button onClick={onStartFresh}>{t('dialogs.pluginDraft.resume.buttons.startFresh')}</Button>
        <Button variant="contained" onClick={onResumePrevious}>
          {t('dialogs.pluginDraft.resume.buttons.resumePrevious')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
