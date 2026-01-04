import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Paper,
  Typography,
} from '@mui/material';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from './mapPreviewSearchTypes.js';

export type MapPreviewSearchSettingsDialogProps<TargetId extends string> = {
  open: boolean;
  searchTargets: Record<TargetId, boolean>;
  targetGroups: Array<MapSearchTargetGroup<TargetId>>;
  targetDefinitions: Record<TargetId, MapSearchTargetDefinition>;
  onClose: () => void;
  onToggleTarget: (targetId: TargetId) => void;
  dialogTitle?: string;
};

export const MapPreviewSearchSettingsDialog = <TargetId extends string>({
  open,
  searchTargets,
  targetGroups,
  targetDefinitions,
  onClose,
  onToggleTarget,
  dialogTitle = '検索対象',
}: MapPreviewSearchSettingsDialogProps<TargetId>) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{dialogTitle}</DialogTitle>
    <DialogContent dividers>
      {targetGroups.map((group) => (
        <Paper key={group.title} variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {group.title}
          </Typography>
          <FormGroup>
            {group.targetIds.map((targetId) => (
              <FormControlLabel
                key={targetId}
                control={(
                  <Checkbox
                    checked={Boolean(searchTargets[targetId])}
                    onChange={() => onToggleTarget(targetId)}
                  />
                )}
                label={targetDefinitions[targetId].label}
              />
            ))}
          </FormGroup>
        </Paper>
      ))}
    </DialogContent>
  </Dialog>
);
