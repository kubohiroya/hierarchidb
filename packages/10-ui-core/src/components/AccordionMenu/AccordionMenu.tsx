import { MouseEvent, ReactNode, useCallback } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box } from '@mui/material';
import { ExpandMoreIcon } from '~/icons';

export const AccordionMenu = ({
  id,
  expanded,
  toggleExpanded,
  onClick,
  accordionDetails,
  children,
}: {
  id: string;
  expanded: boolean;
  toggleExpanded: () => void;
  onClick: (ev: MouseEvent) => void;
  accordionDetails: ReactNode;
  children: ReactNode;
}) => {
  const handleAccordionChange = useCallback(() => {
    // Prevent default accordion behavior - expansion is controlled by the ExpandMoreIcon click
    // This allows the summary content to be clickable without toggling expansion
  }, []);

  return (
    <Accordion id={id} expanded={expanded} onChange={handleAccordionChange}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon style={{ cursor: 'pointer' }} onClick={toggleExpanded} />}
        aria-controls={`${id}-menu-content`}
        style={{ cursor: 'default' }}
        id={`${id}-summary`}
      >
        <Box style={{ cursor: 'pointer', display: 'flex', gap: '4px' }} onClick={onClick}>
          {children}
        </Box>
      </AccordionSummary>
      {expanded && <AccordionDetails>{accordionDetails}</AccordionDetails>}
    </Accordion>
  );
};
