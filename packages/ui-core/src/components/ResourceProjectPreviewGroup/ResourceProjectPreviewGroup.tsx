/**
 * @file ResourceProjectPreviewGroup.tsx
 * @description Unified button group for Resources, Projects, and Preview navigation
 */

import { Button, ButtonGroup, ButtonProps, Tooltip } from '@mui/material';
// @ts-ignore - react-router not available in ui-core
const useNavigate = () => (_path: string, _options?: any) => {}; // Placeholder until moved to proper package
// import { AttachmentIcon, MapIcon } from '~/icons';
import AttachmentIcon from '@mui/icons-material/Attachment';
import MapIcon from '@mui/icons-material/Map';

export type ResourceProjectType = 'resources' | 'projects';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupSize = 'small' | 'medium' | 'large';

interface ResourceProjectPreviewGroupProps {
  /** Currently selected type */
  selected: ResourceProjectType;
  /** Current pageNodeId to preserve */
  currentPageNodeId?: string;
  /** App prefix for routing */
  appPrefix: string;
  /** Callback to get saved pageNodeId for a given type */
  getSavedPageNodeId: (type: ResourceProjectType) => string | null;
  /** Callback to save pageNodeId for a given type */
  savePageNodeId: (type: ResourceProjectType, pageNodeId: string) => void;
  /** Whether preview button is enabled */
  previewEnabled?: boolean;
  /** Callback when preview is clicked */
  onPreviewClick?: () => void;
  /** Button group orientation - horizontal (default) or vertical */
  orientation?: ButtonGroupOrientation;
  /** Button size - small, medium (default), or large */
  size?: ButtonGroupSize;
}

// Utility function to get button color for page type
function getPageButtonColor(pageType: ResourceProjectType): 'primary' | 'secondary' {
  return pageType === 'resources' ? 'primary' : 'secondary';
}

export function ResourceProjectPreviewGroup({
  selected,
  currentPageNodeId,
  appPrefix,
  getSavedPageNodeId,
  savePageNodeId,
  previewEnabled: _previewEnabled = false,
  onPreviewClick: _onPreviewClick,
  orientation = 'horizontal',
  size = 'medium',
}: ResourceProjectPreviewGroupProps) {
  const navigate = useNavigate();

  const handleToggle = (targetType: ResourceProjectType) => {
    // Save current pageNodeId if we're navigating away
    if (targetType !== selected && currentPageNodeId) {
      savePageNodeId(selected, currentPageNodeId);
    }

    // Get saved pageNodeId for target type
    const savedPageNodeId = getSavedPageNodeId(targetType);

    // Navigate to target page
    const basePath = targetType === 'resources' ? 'r' : 'p';
    const targetPath = savedPageNodeId
      ? `/${appPrefix}/t/${basePath}/${savedPageNodeId}`
      : `/${appPrefix}/t/${basePath}`;

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
