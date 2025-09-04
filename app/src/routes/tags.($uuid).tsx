import React, { useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router';
import {
  Container,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Link,
  Card,
  CardContent,
  Grid,
  Breadcrumbs,
} from '@mui/material';
import { LocalOffer as TagIcon, FolderOpen as NodeIcon } from '@mui/icons-material';
import { useQuery } from '~/hooks/useQuery';
import { useWorkerClient } from '~/contexts/WorkerProvider';
import type { TagEntity, NodeTagAssociation, TreeNode, NodeId, TreeId } from '@hierarchidb/common-type';

interface TaggedNode {
  node: TreeNode;
  treeId: TreeId;
  tagAssociation: NodeTagAssociation;
}

export default function TagsPage() {
  const { uuid } = useParams<{ uuid?: string }>();
  const { client: workerClient, isConnected } = useWorkerClient();

  // タグ一覧を取得（uuid未指定時）
  const { data: allTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: async () => {
      const tagAPI = await workerClient.getTagAPI();
      return await tagAPI.getAllTags();
    },
    enabled: !uuid && isConnected,
  });

  // 特定のタグを取得（uuid指定時）
  const { data: specificTag, isLoading: isLoadingTag } = useQuery({
    queryKey: ['tag', uuid],
    queryFn: async () => {
      if (!uuid) return null;
      const tagAPI = await workerClient.getTagAPI();
      return await tagAPI.getTag(uuid as TagEntity['id']);
    },
    enabled: !!uuid && isConnected,
  });

  // タグに関連するノードを取得（uuid指定時）
  const { data: taggedNodes, isLoading: isLoadingNodes } = useQuery({
    queryKey: ['tag', uuid, 'nodes'],
    queryFn: async (): Promise<TaggedNode[]> => {
      if (!uuid) return [];

      const tagAPI = await workerClient.getTagAPI();
      const associations = await tagAPI.getNodesByTag(uuid as TagEntity['id']);

      const taggedNodesData: TaggedNode[] = [];

      for (const association of associations) {
        try {
          // ノード情報を取得
          const queryAPI = await workerClient.getQueryAPI();
          const node = await queryAPI.getNode(association.nodeId);

          if (node) {
            // ツリーIDを取得（ノードからツリーIDを特定）
            const trees = await queryAPI.listTrees();
            let nodeTreeId: TreeId | undefined;

            for (const tree of trees) {
              // 簡単な実装：ツリーが存在すればそのツリーに属すると仮定
              nodeTreeId = tree.id;
              break;
            }

            if (nodeTreeId) {
              taggedNodesData.push({
                node,
                treeId: nodeTreeId,
                tagAssociation: association,
              });
            }
          }
        } catch (error) {
          console.warn('Failed to load node:', association.nodeId, error);
        }
      }

      return taggedNodesData;
    },
    enabled: !!uuid && isConnected,
  });

  const renderTagList = () => {
    if (isLoadingTags) {
      return <Typography>読み込み中...</Typography>;
    }

    if (!allTags || allTags.length === 0) {
      return <Typography>タグが見つかりません。</Typography>;
    }

    return (
      <Grid container spacing={2}>
        {allTags.map((tag: TagEntity) => (
          <Grid key={tag.id}>
            {/*  xs={12} md={4} sm={6} */}
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <TagIcon sx={{ color: tag.color }} />
                  <Link
                    component={RouterLink}
                    to={`/hierarchidb/tags/${tag.id.replace('tag_', '')}`}
                    color="primary"
                    variant="h6"
                    underline="none"
                  >
                    {tag.name}
                  </Link>
                </Box>

                {tag.description && (
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {tag.description}
                  </Typography>
                )}

                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    label={tag.category}
                    color={tag.category === 'system' ? 'primary' : 'default'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    使用回数: {tag.usageCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderTaggedNodes = () => {
    if (isLoadingTag || isLoadingNodes) {
      return <Typography>読み込み中...</Typography>;
    }

    if (!specificTag) {
      return <Typography>タグが見つかりません。</Typography>;
    }

    if (!taggedNodes || taggedNodes.length === 0) {
      return (
        <Box mt={2}>
          <Typography>このタグが付けられたノードはありません。</Typography>
        </Box>
      );
    }

    return (
      <Box mt={3}>
        <Typography variant="h6" gutterBottom>
          タグ付けされたノード ({taggedNodes.length}件)
        </Typography>

        <List>
          {taggedNodes.map(({ node, treeId, tagAssociation }: TaggedNode) => (
            <ListItem
              key={`${treeId}-${node.id}`}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <NodeIcon sx={{ mr: 2, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Link
                    component={RouterLink}
                    to={`/t/${treeId}/${node.id}`}
                    color="primary"
                    underline="none"
                  >
                    {node.name}
                  </Link>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      ノードタイプ: {node.nodeType}
                    </Typography>
                    {tagAssociation.assignedAt && (
                      <Typography variant="caption" color="text.secondary">
                        タグ付け日時: {new Date(tagAssociation.assignedAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  if (!isConnected) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography>Workerに接続中...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/" color="inherit">
          ホーム
        </Link>
        <Link component={RouterLink} to="/hierarchidb/tags" color="inherit">
          タグ
        </Link>
        {uuid && specificTag && <Typography color="text.primary">{specificTag.name}</Typography>}
      </Breadcrumbs>

      {uuid ? (
        // 特定タグの詳細表示
        <Box>
          {specificTag && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <TagIcon sx={{ color: specificTag.color, fontSize: 32 }} />
                <Typography variant="h4">{specificTag.name}</Typography>
                <Chip
                  label={specificTag.category}
                  color={specificTag.category === 'system' ? 'primary' : 'default'}
                />
              </Box>

              {specificTag.description && (
                <Typography variant="body1" color="text.secondary" mb={2}>
                  {specificTag.description}
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                使用回数: {specificTag.usageCount} | 作成日時:{' '}
                {new Date(specificTag.createdAt).toLocaleString()}
                {specificTag.updatedAt && specificTag.updatedAt !== specificTag.createdAt && (
                  <>| 更新日時: {new Date(specificTag.updatedAt).toLocaleString()}</>
                )}
              </Typography>
            </Paper>
          )}

          {renderTaggedNodes()}
        </Box>
      ) : (
        // タグ一覧表示
        <Box>
          <Typography variant="h4" gutterBottom>
            タグ一覧
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            定義済みのタグ一覧です。タグ名をクリックすると、そのタグが付けられたノードの一覧を表示します。
          </Typography>

          {renderTagList()}
        </Box>
      )}
    </Container>
  );
}
