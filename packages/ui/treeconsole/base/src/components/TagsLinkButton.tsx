import { IconButton } from '@mui/material';
import { Sell } from '@mui/icons-material';

export type TagsLinkButtonProps = {
  treeId: string;
  pageNodeId: string;
  onNavigate: () => void;
};

export const TagsLinkButton = (props: TagsLinkButtonProps) => (
  <IconButton
    size="small"
    sx={{ ml: 1, fontSize: '12px' }}
    onClick={props.onNavigate}
    aria-label="tags"
  >
    <Sell />
  </IconButton>
);
