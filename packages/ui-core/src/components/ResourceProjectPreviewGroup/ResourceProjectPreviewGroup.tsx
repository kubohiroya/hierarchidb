/**
 * @file ResourceProjectPreviewGroup.tsx
 * @description Unified button group for Resources, Projects, and Preview navigation
 */

import { Button, ButtonGroup, ButtonProps, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router';
import { AttachmentIcon, MapIcon } from '@/icons';
import { APP_PREFIX } from '@/config/appDescription';

export type ResourceProjectType = 'resources' | 'projects';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'small' | 'medium' | 'large';

interface ResourceProjectPreviewGroupProps {
  /** Currently selected type */
  selected: ResourceProjectType;
  /** Current pageNodeId to preserve in sessionStorage */
  currentPageNodeId?: string;
  /** Whether preview button is enabled */
  previewEnabled?: boolean;
  /** Callback when preview is clicked */
  onPreviewClick?: () => void;
  /** Button group orientation - horizontal (default) or vertical */
  orientation?: ButtonGroupOrientation;
  /** Button size - small, medium (default), or large */
  size?: ButtonGroupSize;
}

const STORAGE_KEYS = {
  RESOURCES_PAGE_NODE_ID: 'resourcesPageNodeId',
  PROJECTS_PAGE_NODE_ID: 'projectsPageNodeId',
} as const;

export function ResourceProjectPreviewGroup({
  selected,
  currentPageNodeId,
  previewEnabled: _previewEnabled = false,
  onPreviewClick: _onPreviewClick,
  orientation = 'horizontal',
  size = 'medium',
}: ResourceProjectPreviewGroupProps) {
  const navigate = useNavigate();

  const handleToggle = (targetType: ResourceProjectType) => {
    // Save current pageNodeId to sessionStorage if we're navigating away
    if (targetType !== selected && currentPageNodeId) {
      const storageKey =
        selected === 'resources'
          ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID
          : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID;
      sessionStorage.setItem(storageKey, currentPageNodeId);
    }

    // Get saved pageNodeId for target type
    const targetStorageKey =
      targetType === 'resources'
        ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID
        : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID;
    const savedPageNodeId = sessionStorage.getItem(targetStorageKey);

    // Navigate to target page
    const basePath = targetType === 'resources' ? 'r' : 'p';
    const targetPath = savedPageNodeId
      ? `/${APP_PREFIX}/t/${basePath}/${savedPageNodeId}`
      : `/${APP_PREFIX}/t/${basePath}`;

    navigate(targetPath, { replace: true });
  };

  return (
    <ButtonGroup
      variant="outlined"
      size={size as ButtonProps['size']}
      orientation={orientation}
      aria-label="Switch between Resources, Projects, and Preview"
      sx={{
        ...(orientation === 'vertical'
          ? {
              '& .MuiButton-root': {
                justifyContent: 'flex-start',
                textTransform: 'none',
                width: '100%',
              },
            }
          : undefined),
        // Apply rounded corners
        '& .MuiButtonGroup-grouped': {
          borderRadius: '20px',
          '&:not(:last-of-type)': {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          '&:not(:first-of-type)': {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
        },
      }}
    >
      <Tooltip title="Resources" placement="bottom">
        <Button
          variant={selected === 'resources' ? 'contained' : 'outlined'}
          color={getPageButtonColor('resources')}
          onClick={() => handleToggle('resources')}
          aria-pressed={selected === 'resources'}
          startIcon={<AttachmentIcon />}
          fullWidth={orientation === 'vertical'}
          sx={{
            '& .MuiButton-startIcon': {
              marginRight: { xs: 0, sm: 0, md: 0, lg: '8px' },
            },
            '& .MuiButton-endIcon': {
              marginLeft: { xs: 0, sm: 0, md: 0, lg: '8px' },
            },
            minWidth: { xs: 'auto', sm: 'auto', md: 'auto', lg: '64px' },
            '& .button-text': {
              display: { xs: 'none', sm: 'none', md: 'none', lg: 'inline' },
            },
          }}
        >
          <span className="button-text">Resources</span>
        </Button>
      </Tooltip>
      <Tooltip title="Projects" placement="bottom">
        <Button
          variant={selected === 'projects' ? 'contained' : 'outlined'}
          color={getPageButtonColor('projects')}
          onClick={() => handleToggle('projects')}
          aria-pressed={selected === 'projects'}
          startIcon={<MapIcon />}
          fullWidth={orientation === 'vertical'}
          sx={{
            '& .MuiButton-startIcon': {
              marginRight: { xs: 0, sm: 0, md: 0, lg: '8px' },
            },
            '& .MuiButton-endIcon': {
              marginLeft: { xs: 0, sm: 0, md: 0, lg: '8px' },
            },
            minWidth: { xs: 'auto', sm: 'auto', md: 'auto', lg: '64px' },
            '& .button-text': {
              display: { xs: 'none', sm: 'none', md: 'none', lg: 'inline' },
            },
          }}
        >
          <span className="button-text">Projects</span>
        </Button>
      </Tooltip>
    </ButtonGroup>
  );
}
