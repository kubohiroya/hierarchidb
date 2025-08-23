import { Button } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface CloseActionButtonProps {
  to: string;
}

export function CloseActionButton({ to }: CloseActionButtonProps) {
  return (
    <Button
      onClick={() => (window.location.href = to)}
      variant="text"
      size="small"
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 'auto',
        borderRadius: '50%',
        p: 1,
      }}
      aria-label="Close Dialog"
      title="Close Dialog"
    >
      <CloseIcon />
    </Button>
  );
}
