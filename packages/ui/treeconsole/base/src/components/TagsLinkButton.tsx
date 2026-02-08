import { IconButton, Link } from '@mui/material';
import { Sell } from '@mui/icons-material';

export const TagsLinkButton = (props: { treeId: string; pageNodeId: string }) => (
  <IconButton
    sx={{ ml: 1 }}
    component={Link}
    href={`/t/${props.treeId}/${props.pageNodeId}/tags`}
    aria-label="tags"
  >
    <Sell />
  </IconButton>
);