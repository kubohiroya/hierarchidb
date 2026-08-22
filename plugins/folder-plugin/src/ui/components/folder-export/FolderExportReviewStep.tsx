import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { Divider, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import type { FolderExportDraftData } from './types.js';
import { normalizeFolderExportDraft } from './types.js';

type Props = PluginStepProps<FolderExportDraftData>;

export const FolderExportReviewStep = ({ data, setValid, setError }: Props) => {
  const draft = normalizeFolderExportDraft(data);

  useEffect(() => {
    setValid(true);
    setError(null);
  }, [setError, setValid]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Review</Typography>
      <List>
        <ListItem>
          <ListItemText
            primary="用途"
            secondary={draft.exportMode === 'continuity' ? '作業継続' : '外部配信'}
          />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText
            primary="対象"
            secondary={
              draft.targetScope === 'shapeOnly' ? 'shape のみ' : 'shape/location/route 全件'
            }
          />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText primary="フォーマット" secondary={draft.format} />
        </ListItem>
        <Divider component="li" />
        <ListItem>
          <ListItemText
            primary="可視化パラメータ"
            secondary={`minZoom=${draft.minZoom}, maxZoom=${draft.maxZoom}, maxTileBytes=${draft.maxTileBytes}, downloadablePayload=${String(
              draft.downloadPayload
            )}`}
          />
        </ListItem>
      </List>
      <Typography color="text.secondary">
        設定が完了したら「Start Build」ボタンからエクスポートを開始できます。
      </Typography>
    </Stack>
  );
};
