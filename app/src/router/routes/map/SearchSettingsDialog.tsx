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
import type { MapSearchTargetId, MapSearchTargetSelection } from '../../../state/mapSearch.atoms.js';
import { SEARCH_TARGET_DEFINITIONS, SEARCH_TARGET_GROUPS } from './constants.js';

export type SearchSettingsDialogProps = {
  open: boolean;
  searchTargets: MapSearchTargetSelection;
  onClose: () => void;
  onToggleTarget: (targetId: MapSearchTargetId) => void;
};

export const SearchSettingsDialog = ({
  open,
  searchTargets,
  onClose,
  onToggleTarget,
}: SearchSettingsDialogProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>検索対象</DialogTitle>
    <DialogContent dividers>
      {SEARCH_TARGET_GROUPS.map((group) => (
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
                label={SEARCH_TARGET_DEFINITIONS[targetId].label}
              />
            ))}
          </FormGroup>
        </Paper>
      ))}
    </DialogContent>
  </Dialog>
);
