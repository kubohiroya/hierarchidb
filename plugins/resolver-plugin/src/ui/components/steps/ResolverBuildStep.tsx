import { Alert, Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import type { ResolverDraft } from '../../../common/types/index.js';

interface ResolverBuildStepProps {
  draft: ResolverDraft;
}

export const ResolverBuildStep: React.FC<ResolverBuildStepProps> = ({ draft }) => {
  const hasSchemas = Boolean(draft.sourceSchema && draft.targetSchema);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        Confirm your schema mapping configuration. When ready, click <strong>Build</strong> to run
        the resolver batch pipeline.
      </Typography>

      <List dense>
        <ListItem>
          <ListItemText
            primary="Source Schema"
            secondary={draft.sourceSchema?.name ?? 'Not selected'}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Target Schema"
            secondary={draft.targetSchema?.name ?? 'Not selected'}
          />
        </ListItem>
      </List>

      {!hasSchemas && (
        <Alert severity="info">
          Select both source and target schemas along with mapping rules before building.
        </Alert>
      )}

      <Alert severity="success">
        The <strong>Build</strong> button below will start validation tests and compile your resolver
        configuration.
      </Alert>
    </Box>
  );
};
