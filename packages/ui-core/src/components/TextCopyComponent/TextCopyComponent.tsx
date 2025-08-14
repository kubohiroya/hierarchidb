import { useCallback, useState } from 'react';
import { Check, ContentCopy, ReportProblem } from '@mui/icons-material';
import { IconButton, Typography } from '@mui/material';

// import { devError } from "@/shared/utils/logger";
export const TextCopyComponent = ({ createText }: { createText: () => string }) => {
  const [copyResult, setCopyResult] = useState<boolean | null>(null);
  const copyTextToClipboard = useCallback(async () => {
    try {
      const text = createText();
      // devLog("text", text);
      await navigator.clipboard.writeText(text);
      setCopyResult(true);
    } catch (err) {
      console.error('Failed to copy: ', err);
      setCopyResult(false);
    }
  }, [createText]);

  return (
    <IconButton onClick={copyTextToClipboard}>
      <Typography>
        <ContentCopy />
        {copyResult === null ? null : copyResult ? <Check /> : <ReportProblem />}
      </Typography>
    </IconButton>
  );
};
