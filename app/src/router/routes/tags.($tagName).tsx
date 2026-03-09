import type { TreeId } from '@hierarchidb/core-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { LocalOffer as TagIcon } from '@mui/icons-material';
import {
  Box,
  Container,
  List,
  ListItem,
  Paper,
  Typography,
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useTagsPage } from './useTagsPage.js';

type TaggedNodeRow = {
  id: string;
  breadcrumbNodes: BreadcrumbNode[];
  treeId?: TreeId;
};

function decodeTagName(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function TagDetailPage({ tagName }: { tagName?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const resolvedTagName = useMemo(() => decodeTagName(tagName), [tagName]);
  const { isConnected, isLoadingNodes, isLoadingTag, specificTag, taggedNodes } =
    useTagsPage(resolvedTagName);

  const rows = useMemo<TaggedNodeRow[]>(
    () =>
      taggedNodes.map((item) => ({
        id: item.node.id,
        breadcrumbNodes: item.breadcrumbNodes,
        treeId: item.treeId,
      })),
    [taggedNodes]
  );

  if (!isConnected) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography>{t('tags.detail.connectingWorker')}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box>
        {specificTag && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TagIcon sx={{ color: specificTag.color, fontSize: 32 }} />
              <Typography variant="h4">{specificTag.name}</Typography>
            </Box>

            {specificTag.description && (
              <Typography variant="body1" color="text.secondary" mb={2}>
                {specificTag.description}
              </Typography>
            )}
          </Paper>
        )}

        {isLoadingTag || isLoadingNodes ? (
          <Typography>{t('tags.detail.loading')}</Typography>
        ) : !specificTag ? (
          <Typography>{t('tags.detail.notFound')}</Typography>
        ) : rows.length === 0 ? (
          <Typography>{t('tags.detail.empty')}</Typography>
        ) : (
          <List>
            {rows.map((row) => (
              <ListItem
                key={row.id}
                sx={{ alignItems: 'center', flexDirection: 'row', py: 2 }}
              >
                <TreeConsoleBreadcrumb
                  nodePath={row.breadcrumbNodes}
                  currentNodeId={row.id}
                  treeId={row.treeId ? String(row.treeId) : undefined}
                  variant="minimal"
                  onNodeClick={(nodeId) => {
                    if (!row.treeId) return;
                    navigate({ to: `/t/${row.treeId}/${nodeId}` });
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Container>
  );
}
