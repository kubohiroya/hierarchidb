import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  FilterAlt as FilterAltIcon,
  InfoOutlined as InfoOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';

type Props = {
  disabled?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({ disabled }) => {
  const { t } = useTranslation();

  const summaryHelp = t(
    'processing.transform.summaryHelpTurf',
    'Transform runs turf.simplify with the configured tolerance.',
  );

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.transform.title', 'Transform')}
          </Typography>
          <Tooltip
            title={summaryHelp}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={1} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'processing.transform.concurrencyMovedToBuildStep',
              'Transform concurrency has moved to the Build step. Click the stage spinner in progress summary to edit it.',
            )}
          </Typography>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
